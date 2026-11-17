-- v506: the Pre-Mass seat and the two new prayer-book rows.
-- Part A: the Prayer of St. Ambrose before Mass and the
-- Prayer of St. Thomas Aquinas before Mass join the book
-- (Blessed Be God, Callan & McHugh, 1925 — public domain;
-- texts verified word-for-word against the edition; the
-- harness fixture app/tests/fixtures-v506/
-- blessed-be-god-premass.txt carries the same bodies).
-- They stand at the head of the Mass & Communion group
-- (sorts 3005/3006, ahead of prayer-before-mass at 3010).
-- The edition prints English only: body_latin NULL.
-- Part B: the mass_personal_prayer store gains the
-- 'premass' seat — the table is rebuilt in the 0033
-- pattern (seat is the primary key; the CHECK is the
-- only seat list), the three standing rows copied whole,
-- and the premass row seeded with the traditional
-- prayers before Mass in seed order: the two new rows,
-- then the standing prayer-before-mass and
-- prayer-before-a-crucifix (which carries its Latin).
INSERT INTO prayer_book (slug, title, category, body, body_latin, source, sort) VALUES (
  'prayer-of-st-ambrose-before-mass',
  'Prayer of St. Ambrose before Mass',
  'Mass & Communion',
  'O Almighty and eternal God, behold I approach the sacrament of Thine only-begotten Son, our Lord Jesus Christ. I approach as one that is sick to the physician of life, as one unclean to the fountain of mercy, as one blind to the light of eternal brightness, as one poor and needy to the Lord of heaven and earth. Therefore I beseech Thee of Thine infinite goodness to heal my sickness, to wash away my filth, to illumine my blindness, to enrich my poverty, and to clothe my nakedness, that I may receive the bread of Angels, the King of kings, the Lord of lords, with such reverence and humility, such sorrow and love, such faith and purity, as are expedient for the salvation of my soul. Give me grace not only to receive the sacrament of our Lord''s Body and Blood, but also the grace and power of the sacrament. O most gracious God, grant me so to receive the Body of Thine only-begotten Son, our Lord Jesus Christ, which He took from the Virgin Mary, as to merit to be incorporated into His mystical Body, and to be numbered among His members. O most loving Father, give me grace finally to behold Thy beloved Son, whom now I intend to receive under the sacramental veil, face to face, unveiled for all eternity, who livest and reignest with Thee in the unity of the Holy Ghost, God, world without end. Amen.',
  NULL,
  'Blessed Be God (Callan & McHugh, 1925), Preparation for Communion',
  3005
);
INSERT INTO prayer_book (slug, title, category, body, body_latin, source, sort) VALUES (
  'prayer-of-st-thomas-aquinas-before-mass',
  'Prayer of St. Thomas Aquinas before Mass',
  'Mass & Communion',
  'O Gracious Lord Jesus Christ, I, a sinner, not presuming on my own merits, but trusting in Thy goodness and mercy, fear and tremble in approaching Thy most sweet and delicious banquet. For I have defiled my heart and body with many sins, and have not kept a strict guard over my thoughts and my tongue. Wherefore, O gracious God, O awful Majesty, I, a wretched creature, entangled in difficulties, have recourse to Thee, the fount of mercy, to Thee do I fly that I may be healed and take refuge under Thy protection. And I long for Him as my Saviour whom I cannot bear as my Judge.

To Thee, O Lord, I show my wounds, to Thee I lay bare my shame. I know my sins to be many and great, and on their account I am filled with fear. But I trust in Thy mercy, of which there is no end. Look down upon me, therefore, with the eyes of Thy mercy, O Lord Jesus Christ, eternal King, God and Man, crucified for men. Hearken unto me, for my hope is in Thee; have mercy on me, who am full of sin and misery, Thou who wilt never cease to let flow the fountain of mercy.

Hail, Victim of salvation, offered for me and for all mankind on the gibbet of the Cross. Hail, noble and most Precious Blood, flowing from the wounds of my crucified Lord Jesus Christ, and washing away the sins of the whole world. Remember, O Lord, Thy creature, whom Thou has redeemed with Thy most Precious Blood.

I am grieved with great sorrow for my sins; I detest them and I desire to amend my life. What shall I do, unhappy sinner, but confess my guilt before Thee, and call upon Thy holy name? Of Thy goodness, most merciful God, I ask forgiveness of my sins. Grant that I may worthily eat and drink the Body and Blood of Jesus Christ Thy Son, and I pray that this Holy Communion may not bring guilt upon me to punishment, but intercession for pardon unto salvation.

May it be to me the armour of faith, and the shield of a good will. May it root out from my heart all vice; may it utterly subdue my evil passions and all my unruly appetites. May it perfect me in charity and patience; in humility and obedience; and in all other virtues. May it be a strong defence against the snares of all my enemies, visible and invisible; the perfect quieting of all my evil inclinations of flesh and spirit. May it bind me firmly to Thee, the one true God; and may the happy completion of my course be mine when Thou shalt call me, a sinner, to that ineffable banquet, where with Thy Son and the Holy Ghost Thou art to Thy holy ones true light, fulness of blessedness, everlasting joy, and perfect happiness. Through the same Christ our Lord. Amen.',
  NULL,
  'Blessed Be God (Callan & McHugh, 1925), Preparation for Communion',
  3006
);
CREATE TABLE mass_personal_prayer_new (
  seat TEXT PRIMARY KEY CHECK (seat IN ('before','after','aftermass','premass')),
  slugs TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO mass_personal_prayer_new (seat, slugs, updated_at)
  SELECT seat, slugs, updated_at FROM mass_personal_prayer;
DROP TABLE mass_personal_prayer;
ALTER TABLE mass_personal_prayer_new RENAME TO mass_personal_prayer;
INSERT INTO mass_personal_prayer (seat, slugs, updated_at) VALUES (
  'premass',
  '["prayer-of-st-ambrose-before-mass","prayer-of-st-thomas-aquinas-before-mass","prayer-before-mass","prayer-before-a-crucifix"]',
  '2026-11-17T00:00:00.000Z'
);
