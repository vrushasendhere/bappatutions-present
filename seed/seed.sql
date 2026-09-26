-- Two sample library decks, to prove the gallery → view → present flow end
-- to end (Phase 1 verification). No real course content yet — that's
-- authored later, through this same app, once it exists.

INSERT INTO presentations (
  id, title, theme, subject, standard, slides, background_music_r2_key,
  is_library, owner_user_id, owner_anon_id, forked_from, saved, expires_at,
  created_at, updated_at
) VALUES (
  'seed-plant-parts',
  'Parts of a Plant',
  'classic',
  'Science',
  '4',
  '[
    {"id":"s1","order":0,"templateKey":"title","content":{"heading":"Parts of a Plant","body":"What every plant needs to grow"}},
    {"id":"s2","order":1,"templateKey":"bullets","content":{"heading":"The Main Parts","bullets":["Roots — hold the plant and drink water","Stem — carries water up to the leaves","Leaves — make food using sunlight","Flower — makes seeds for new plants"]}},
    {"id":"s3","order":2,"templateKey":"text","content":{"heading":"Why it matters","body":"Every part has a job. If one part stops working, the whole plant suffers."}}
  ]',
  NULL, 1, NULL, NULL, NULL, 1, NULL,
  (unixepoch()), (unixepoch())
);

INSERT INTO presentations (
  id, title, theme, subject, standard, slides, background_music_r2_key,
  is_library, owner_user_id, owner_anon_id, forked_from, saved, expires_at,
  created_at, updated_at
) VALUES (
  'seed-water-cycle',
  'The Water Cycle',
  'classic',
  'Science',
  '5',
  '[
    {"id":"s1","order":0,"templateKey":"title","content":{"heading":"The Water Cycle","body":"How water travels around our planet"}},
    {"id":"s2","order":1,"templateKey":"bullets","content":{"heading":"Four Steps","bullets":["Evaporation — the sun heats water and turns it into vapour","Condensation — vapour cools and forms clouds","Precipitation — clouds release rain or snow","Collection — water gathers in rivers, lakes and oceans"]}},
    {"id":"s3","order":2,"templateKey":"text","content":{"heading":"It never stops","body":"The water you drink today may have been rain a thousand years ago."}}
  ]',
  NULL, 1, NULL, NULL, NULL, 1, NULL,
  (unixepoch()), (unixepoch())
);
