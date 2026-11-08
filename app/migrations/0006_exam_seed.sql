-- v305 migration 0006 — examination + confession-guide seed content.
-- Source (named per Scope Open decision 1): the examination of
-- conscience in Fr. F. X. Lasance, "My Prayer Book" (Benziger
-- Brothers, 1908; public domain) — "Devotions for Confession",
-- pp. 347-349 (examination) and pp. 353-354 (the confession guide
-- and Act of Contrition). Text is seeded verbatim (the book's own
-- paragraphing; only scan-spacing artifacts cleaned). Every prompt
-- stays editable by John in-app afterward.
INSERT INTO exam_prompts (category, commandment_no, text, sort, source) VALUES
  ('Preliminary Examination', NULL, 'Did you omit to confess a mortal sin, either intentionally or through forgetfulness?', 10, 'Lasance, My Prayer Book (1908), p. 347'),
  ('Preliminary Examination', NULL, 'Did you intentionally neglect to say the penance which was imposed on you, or were you so careless as to forget it?', 20, 'Lasance, My Prayer Book (1908), p. 347'),
  ('Preliminary Examination', NULL, 'Have you carried out the resolutions you made at your last confession or have you paid no heed at all to them?', 30, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you doubted in matters of faith? Murmured against God at your adversity or at the prosperity of others? Despaired of His mercy?', 110, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you believed in fortune-tellers or consulted them?', 120, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you gone to places of worship belonging to other denominations?', 130, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you recommended yourself daily to God? Neglected your morning or night prayers? Omitted religious duties or practices through motives of human respect?', 140, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you rashly presumed upon God''s forbearance in order to commit sin?', 150, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment I', 1, 'Have you read books, papers, and periodicals of anti-Catholic or atheistic tendency? Made use of superstitious practices? Spoken with levity or irreverence of priests, Religious, or sacred objects?', 160, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment II', 2, 'Have you taken the name of God in vain? Profaned anything relating to religion?', 210, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment II', 2, 'Have you sworn falsely, rashly, or in slight and trivial matters? Cursed yourself or others, or any creature? Angered others so as to make them swear, or blaspheme?', 220, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment III', 3, 'Have you kept holy the Lord''s Day, and all other days commanded to be kept holy? Bought or sold things, not of necessity, on that day? Done or commanded some servile work not of necessity? Missed Mass or been wilfully distracted during Mass? Talked, gazed, or laughed in the church? Profaned the day by dancing, drinking, gambling, or in other ways?', 310, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment IV', 4, 'Have you honored your parents, superiors, and masters, according to your just duty? Deceived them? Disobeyed them?', 410, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment IV', 4, 'Have you failed in due reverence to aged persons?', 420, 'Lasance, My Prayer Book (1908), p. 348'),
  ('Commandment V', 5, 'Have you procured, desired, or hastened the death of any one? Borne hatred? Oppressed any one? Desired revenge? Not forgiven injuries? Refused to speak to others? Used provoking language? Injured others? Caused enmity between others?', 510, 'Lasance, My Prayer Book (1908), pp. 348-349'),
  ('Commandment VI and IX', 6, 'Have you been guilty of lascivious dressing? Been in lewd company? Read immodest books? Been guilty of unchaste songs, discourses, words, or actions? Wilfully entertained impure thoughts or desires?', 610, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment VII', 7, 'Have you been guilty of stealing, or of deceit in buying, or selling, in regard to wares, prices, weights, or measures? Have you wilfully damaged another man''s goods, or negligently spoiled them?', 710, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment VIII', 8, 'Have you borne false witness? Called injurious names? Disclosed another''s sins? Flattered others? Judged rashly?', 810, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Commandment X', 10, 'Have you coveted unjustly anything that belongs to another?', 1010, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you gone to confession at least once a year? Received holy communion during Easter-time?', 1110, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you violated the fasts of the Church, or eaten flesh-meat on prohibited days?', 1120, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Precepts of the Church', NULL, 'Have you sinned against any other commandment of the Church?', 1130, 'Lasance, My Prayer Book (1908), p. 349'),
  ('Capital Sins', NULL, 'Examine yourself also in regard to the Seven Capital Sins and the nine ways of being accessory to another''s sin.', 1210, 'Lasance, My Prayer Book (1908), p. 349');

INSERT INTO confession_guide (step_no, title, body) VALUES
  (1, 'Opening', 'Approach the confessional with the same recollectedness and reverence as would fill your heart if Christ our Lord were seated there in person ready to hear your confession. The priest is really the representative of Christ. When you kneel down, say: Bless me, Father, for I have sinned, and then begin the Confiteor, proceeding as far as "through my fault," etc. Then tell when you made your last confession and begin the avowal of your sins.'),
  (2, 'The list', 'Confess all your sins with a contrite and humble heart, and conclude thus: For these and all the sins of my past life, especially my sins of — , I am heartily sorry, beg pardon of God, and absolution of you, my Father; then finish the Confiteor: Therefore I beseech the blessed Mary ever Virgin, blessed Michael the archangel, blessed John the Baptist, the holy apostles Peter and Paul, and all the saints, to pray to the Lord our God for me.'),
  (3, 'Act of Contrition', 'O my God, confessing my guilt and with a contrite heart I kneel before Thee and implore Thee to look upon me according to the multitude of Thy mercies. I detest and am heartily sorry for all my sins, not only because I dread the loss of heaven and the pain of hell, but also and principally because by them I have offended Thee, Who art infinitely good and deserving of all my love. I firmly resolve, with the help of Thy grace, to confess my sins and to amend my life. I acknowledge Thee, O God, to be the Supreme Good, and I love Thee with all my heart. Be merciful to me, a poor sinner. I beseech Thee, by the passion and death of Jesus Christ, Thy Son, to forgive me my sins. Amen.'),
  (4, 'Penance', 'Listen then with humility and docility to the instruction of your confessor, and during this time avoid all recurrence as to the confession itself; remembering that sins forgotten after a serious examination are really comprised in the absolution. Accept with submission the penance imposed, and if any obstacle that you foresee will prevent your accomplishing it, state this respectfully.'),
  (5, 'Final blessing', 'While the priest pronounces the words of absolution, endeavor to excite an act of perfect contrition.');
