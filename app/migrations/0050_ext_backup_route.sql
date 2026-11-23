-- v628 migration 0050 — the standing backup pointer + the fill
-- route on the server-side feed resolution store (release doc
-- §2): ext_resolutions gains backup_url + backup_source (the
-- OTHER source's pointer for the Morning/Evening slots — the
-- watcher stands BOTH pointers and the device applies the
-- user's Sing the Hours preference at paint/play) and route
-- (the Divine Office fetch route that filled the row: 'feed' /
-- 'synthesis' / 'scrape'; stamped last, after source, in the
-- standing positional discipline). Every synthesis/scrape fill
-- is flagged by its route for the nightly report.
ALTER TABLE ext_resolutions ADD COLUMN backup_url TEXT;
ALTER TABLE ext_resolutions ADD COLUMN backup_source TEXT;
ALTER TABLE ext_resolutions ADD COLUMN route TEXT;
