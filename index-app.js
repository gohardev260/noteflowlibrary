/**
 * Public site boot script that renders ONLY Supabase notes.
 * It disables the original inline script in index.html (set to type="text/plain")
 * and re-implements dynamic rendering, filtering, preview, and download.
 *
 * Requirements:
 * - supabase-js v2
 * - supabase-config.js (exposes window.supabaseClient)
 * - notes-api.js (exposes window.NotesAPI)
 */

(function () {
  // Guard
  if (!window.NotesAPI) {
    console.error('[index-app] NotesAPI not found. Ensure notes-api.js is included after supabase-config.js.');
    return;
  }

  
  // DOM elements
  const grid = document.getElementById('cardsGrid');
  const searchInput = document.getElementById('searchInput');
  const clearSearch = document.getElementById('clearSearch');
  const classFilter = document.getElementById('classFilter');
  const resetFilters = document.getElementById('resetFilters');
  const visibleCount = document.getElementById('visibleCount');
  const countChip = document.getElementById('countChip');
  const totalCountText = document.getElementById('totalCountText');
  const quickTagsWrap = document.getElementById('quickTags');

  let cards = []; // will be populated after render
  let observer = null;
  let liveRegion = null;

  function buildCard(note) {
    const article = document.createElement('article');
    article.className = 'note-card will-animate';
    article.setAttribute('tabindex', '0');
    // dataset attributes used by filtering and preview
    article.dataset.title = note.title || 'Untitled';
    article.dataset.tags = (note.tags || '').trim();
    article.dataset.class = note.class || 'General';
    article.dataset.fileUrl = (note.fileUrl || '').trim();
    article.dataset.id = note.id || '';

    // Image wrap
    const imageWrap = document.createElement('div');
    imageWrap.className = 'image-wrap';

    const img = document.createElement('img');
    // Progressive loading + avoid broken previews due to hotlinking referer checks
    img.loading = 'lazy';
    img.decoding = 'async';
    try { img.referrerPolicy = 'no-referrer'; } catch (_) {}
    img.src = note.image || '';
    img.alt = `Cover image for ${note.title || 'note'}`;
    img.addEventListener('load', () => {
      // Ensure visible if image loads after a prior fallback state
      img.style.display = '';
      imageWrap.classList.remove('img-fallback');
    });
    img.addEventListener('error', () => {
      img.style.display = 'none';
      imageWrap.classList.add('img-fallback');
    });
    // If no image provided, immediately show fallback (onerror may not fire for empty src)
    if (!note.image || !String(note.image).trim()) {
      img.style.display = 'none';
      imageWrap.classList.add('img-fallback');
    }
    imageWrap.appendChild(img);

    const fallback = document.createElement('div');
    fallback.className = 'fallback-graphic';
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = `Image unavailable — ${note.class || 'Note'}`;
    fallback.appendChild(chip);
    imageWrap.appendChild(fallback);

    // Body
    const body = document.createElement('div');
    body.className = 'p-5 flex flex-col gap-4';

    // Header
    const header = document.createElement('header');
    header.className = 'flex items-start justify-between gap-3';

    const h3 = document.createElement('h3');
    h3.className = 'font-semibold text-lg leading-snug';
    h3.textContent = note.title || 'Untitled';

    const classChip = document.createElement('span');
    classChip.className = 'px-2 py-1 rounded-md text-xs border';
    classChip.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
    classChip.style.color = 'var(--brown)';
    classChip.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    classChip.textContent = note.class || 'General';

    header.appendChild(h3);
    header.appendChild(classChip);

    // Description
    const desc = document.createElement('p');
    desc.className = 'text-sm text-slate-400 line-clamp-3';
    desc.textContent = note.description || '';

    // Tags
    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'flex flex-wrap gap-2';
    (note.tags || '').split(',').map(s => s.trim()).filter(Boolean).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.dataset.tag = tag;
      span.textContent = tag;
      // Make tag chips interactive for filtering
      span.addEventListener('click', () => setSearchValue(tag));
      tagsWrap.appendChild(span);
    });

      // Buttons
      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2 pt-1 flex-wrap';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn download-btn';
      downloadBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0 3.5-3.5M12 14 8.5 10.5M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download
      `;

      actions.appendChild(downloadBtn);

    // Assemble
    body.appendChild(header);
    body.appendChild(desc);
    body.appendChild(tagsWrap);
    body.appendChild(actions);

    article.appendChild(imageWrap);
    article.appendChild(body);

      // Bind actions
      downloadBtn.addEventListener('click', () => triggerDownload(article));

    return article;
  }

  function triggerDownload(card) {
    const fileUrl = (card.dataset.fileUrl || '').trim();
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
  }

  
  function setSearchValue(val) {
    searchInput.value = val;
    applyFilters();
  }

  function populateClasses() {
    // Preserve selection and the "All" option
    const previous = classFilter.value;
    const preservedAll = Array.from(classFilter.querySelectorAll('option')).filter(o => o.value === 'All');
    classFilter.innerHTML = '';
    preservedAll.forEach(o => classFilter.appendChild(o));

    const classes = new Set(cards.map(c => c.dataset.class));
    const frag = document.createDocumentFragment();
    Array.from(classes).sort().forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      frag.appendChild(opt);
    });
    classFilter.appendChild(frag);

    // Restore previous selection if still present
    if (Array.from(classFilter.options).some(o => o.value === previous)) {
      classFilter.value = previous;
    } else {
      classFilter.value = 'All';
    }

    // Counters for total
    countChip.textContent = cards.length + ' notes';
    totalCountText.textContent = 'of ' + cards.length + ' notes';
  }

  function populateQuickTags() {
    if (!quickTagsWrap) return;

    // Get current class filter
    const selectedClass = classFilter ? classFilter.value : 'All';

    // Collect tags only from cards that match the current class filter
    const tagCounts = new Map();
    cards.forEach(card => {
      const cardClass = card.dataset.class;
      
      // Only include tags from cards that match the current class filter
      if (selectedClass === 'All' || selectedClass === cardClass) {
        const tags = (card.dataset.tags || '').split(',').map(s => s.trim()).filter(Boolean);
        tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Sort tags by frequency (most popular first) and take top 8
    const popularTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

    // Clear existing tags and populate with dynamic ones
    quickTagsWrap.innerHTML = '';
    
    if (popularTags.length === 0) {
      // Show a message if no tags are available
      const noTagsMsg = document.createElement('span');
      noTagsMsg.className = 'text-sm opacity-60';
      noTagsMsg.style.color = 'var(--medium-brown)';
      noTagsMsg.textContent = selectedClass === 'All' ? 'No tags available' : `No tags available for ${selectedClass}`;
      quickTagsWrap.appendChild(noTagsMsg);
      return;
    }

    const frag = document.createDocumentFragment();
    popularTags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.dataset.tag = tag;
      span.textContent = '#' + tag;
      span.addEventListener('click', () => setSearchValue(tag));
      frag.appendChild(span);
    });
    quickTagsWrap.appendChild(frag);
  }

  function setupIntersectionObserver() {
    if (observer) {
      // disconnect previous one if any
      observer.disconnect();
    }
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    cards.forEach(c => observer.observe(c));
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const cls = classFilter.value;

    let shown = 0;
    cards.forEach(card => {
      const title = (card.dataset.title || '').toLowerCase();
      const tagStr = (card.dataset.tags || '').toLowerCase();
      const cardClass = card.dataset.class;

      const matchSearch = q === '' || title.includes(q) || tagStr.includes(q);
      const matchClass = cls === 'All' || cls === cardClass;

      const visible = matchSearch && matchClass;
      card.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });

    // Update counts
    visibleCount.textContent = 'Showing ' + shown;
    totalCountText.textContent = 'of ' + cards.length + ' notes';
  }

  function setupLiveRegion() {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
    const originalApply = applyFilters;
    function announceFilters() {
      originalApply();
      liveRegion.textContent = visibleCount.textContent + ' ' + totalCountText.textContent;
    }

    // Bindings for announce
    searchInput.removeEventListener('input', applyFilters);
    classFilter.removeEventListener('change', applyFilters);
    searchInput.addEventListener('input', announceFilters);
    classFilter.addEventListener('change', () => {
      populateQuickTags(); // Update quick tags when class filter changes
      announceFilters();
    });
    clearSearch.addEventListener('click', announceFilters);
    resetFilters.addEventListener('click', () => {
      populateQuickTags(); // Update quick tags when filters are reset
      announceFilters();
    });

    // Initial announce
    announceFilters();
  }

  function bindUIEvents() {
    // Quick tags container
    if (quickTagsWrap) {
      quickTagsWrap.addEventListener('click', e => {
        const tag = e.target.closest('.tag')?.dataset.tag;
        if (tag) setSearchValue(tag);
      });
    }

    // Make tags inside cards interactive
    cards.forEach(card => {
      card.querySelectorAll('.tag').forEach(tagEl => {
        tagEl.addEventListener('click', () => {
          setSearchValue(tagEl.dataset.tag || tagEl.textContent.trim());
        });
      });
    });

    // Basic bindings (applyFilters used by live region wrapper later)
    searchInput.addEventListener('input', applyFilters);
    classFilter.addEventListener('change', applyFilters);
    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    });
    resetFilters.addEventListener('click', () => {
      searchInput.value = '';
      classFilter.value = 'All';
      applyFilters();
    });
  }

  // Realtime helpers
  let notesChannel = null;

  function getCardById(id) {
    if (!id) return null;
    return grid.querySelector('.note-card[data-id="' + id + '"]');
  }

  function refreshMeta() {
    populateClasses();
    populateQuickTags();
    applyFilters();
    if (liveRegion) {
      liveRegion.textContent = visibleCount.textContent + ' ' + totalCountText.textContent;
    }
  }

  function addCard(note) {
    if (!note || !note.id) return;
    if (getCardById(note.id)) {
      updateCard(note);
      return;
    }
    const card = buildCard(note);
    // Prepend newest
    if (grid.firstChild) {
      grid.insertBefore(card, grid.firstChild);
    } else {
      grid.appendChild(card);
    }
    cards = Array.from(grid.querySelectorAll('.note-card'));
    setupIntersectionObserver();
    refreshMeta();
  }

  function updateCard(note) {
    if (!note || !note.id) return;
    const existing = getCardById(note.id);
    if (!existing) {
      addCard(note);
      return;
    }
    const newCard = buildCard(note);
    existing.replaceWith(newCard);
    cards = Array.from(grid.querySelectorAll('.note-card'));
    setupIntersectionObserver();
    refreshMeta();
  }

  function removeCard(id) {
    const existing = getCardById(id);
    if (existing) {
      existing.remove();
      cards = Array.from(grid.querySelectorAll('.note-card'));
      setupIntersectionObserver();
      refreshMeta();
    }
  }

  function setupRealtime() {
    if (notesChannel) return;
    notesChannel = window.supabaseClient
      .channel('public:notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        const note = window.NotesAPI.mapDbToUi(payload.new);
        addCard(note);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' }, (payload) => {
        const note = window.NotesAPI.mapDbToUi(payload.new);
        updateCard(note);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (payload) => {
        removeCard(payload.old?.id);
      })
      .subscribe();
  }

  async function loadAndRenderNotes() {
    // Remove any static demo cards and show only DB notes
    grid.innerHTML = '';

    // Simple loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'text-slate-400 py-6';
    loadingEl.textContent = 'Loading notes...';
    grid.parentElement.insertBefore(loadingEl, grid);

    try {
      const notes = await window.NotesAPI.listNotes();
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      notes.forEach(note => {
        const card = buildCard(note);
        frag.appendChild(card);
      });
      grid.appendChild(frag);

      cards = Array.from(grid.querySelectorAll('.note-card'));

      populateClasses();
      populateQuickTags();
      setupIntersectionObserver();
      bindUIEvents();
      // Replace bindings with live region announcing wrapper
      setupLiveRegion();
      // Realtime subscription for live updates
      setupRealtime();
    } catch (err) {
      console.error('[index-app] Failed to load notes', err);
      grid.innerHTML = '';
      const errorEl = document.createElement('div');
      errorEl.className = 'text-red-400 py-6';
      errorEl.textContent = 'Failed to load notes. Please try again later.';
      grid.appendChild(errorEl);
      // Reset counters
      countChip.textContent = '0 notes';
      visibleCount.textContent = 'Showing 0';
      totalCountText.textContent = 'of 0 notes';
    } finally {
      loadingEl.remove();
    }
  }

  // Kickoff after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRenderNotes);
  } else {
    loadAndRenderNotes();
  }
})();
