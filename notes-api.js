/**
 * NotesAPI - Thin Supabase CRUD wrapper for NoteFlow
 * Requires window.supabaseClient (initialized by supabase-config.js)
 * Exposes global: window.NotesAPI
 */
(function () {
  if (!window.supabaseClient) {
    console.error('[NotesAPI] Supabase client not found. Load supabase-js and supabase-config.js first.');
    return;
  }
  const client = window.supabaseClient;

  function mapDbToUi(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title || '',
      class: row.class || '',
      tags: row.tags || '',
      description: row.description || '',
      image: row.image || '',
      fileUrl: row.file_url || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function mapUiToDb(note) {
    return {
      title: note.title || '',
      class: note.class || '',
      tags: note.tags || '',
      description: note.description || '',
      image: note.image || '',
      file_url: note.fileUrl || note.file_url || ''
    };
  }

  async function listNotes() {
    const { data, error } = await client
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbToUi);
  }

  async function getNote(id) {
    const { data, error } = await client
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return mapDbToUi(data);
  }

  async function createNote(note) {
    const payload = mapUiToDb(note);
    const { data, error } = await client
      .from('notes')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return mapDbToUi(data);
  }

  async function updateNote(id, note) {
    const payload = mapUiToDb(note);
    const { data, error } = await client
      .from('notes')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapDbToUi(data);
  }

  async function deleteNote(id) {
    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  window.NotesAPI = {
    listNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    mapDbToUi,
    mapUiToDb
  };
})();
