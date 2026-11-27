-- v699 migration 0053 — the Stations of the Cross join the
-- prayer book (Plan §2.1 seat 2 / §1.5). The catalog record
-- did not exist anywhere in the estate (Plan §1.3 proven
-- negative); this INSERT-only row creates it. Category
-- "The Raccolta" (OPEN-1, decided by the coordinator under
-- decide-and-move, the Plan's recommendation) in the 9xxx
-- sort band after the standing Raccolta rows (9010-9080).
-- Text: St. Alphonsus Liguori, "The Way of the Cross"
-- (public domain; the traditional Alphonsus stations —
-- preparatory prayer, the fourteen stations each with its
-- versicle/response, meditation, prayer, "Our Father, Hail
-- Mary and Glory Be" and the closing verse, ending "St.
-- Alphonsus Liguori, pray for us. Amen."). Recitation
-- rubrics in the source (the ending indulgence direction)
-- are directions, not prayer text, and are not seeded —
-- the book's standing convention (migration 0026).
-- body_latin NULL: no Latin text stands for this devotion.
INSERT INTO prayer_book (slug, title, category, body, body_latin, source, sort) VALUES
  ('stations-of-the-cross', 'Stations of the Cross', 'The Raccolta', 'Kneeling before the altar, make an Act of Contrition, and form the intention of gaining the indulgences, whether for yourself or for the souls in Purgatory.

PREPARATORY PRAYER

My Lord Jesus Christ, Thou hast made this journey to die for me with love unutterable, and I have so many times unworthily abandoned Thee; but now I love Thee with my whole heart, and because I love Thee, I repent sincerely for ever having offended Thee. Pardon me, my God, and permit me to accompany Thee on this journey. Thou goest to die for love of me; I wish also, my beloved Redeemer, to die for love of Thee. My Jesus, I will live and die always united to Thee.

STATION 1: JESUS IS CONDEMNED TO DEATH

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world.

Consider how Jesus, after having been scourged and crowned with thorns, was unjustly condemned by Pilate to die on the Cross.

My adorable Jesus, it was not Pilate, no, it was my sins that condemned Thee to die. I beseech Thee, by the merits of this sorrowful journey, to assist my soul in its journey towards eternity. I love Thee, my beloved Jesus; I repent with my whole heart for having offended Thee. Never permit me to separate myself from Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be.

Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 2: JESUS BEARS HIS CROSS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world.

Consider how Jesus, in making this journey with the Cross on His shoulders thought of us, and for us offered to His Father the death He was about to undergo.

My most beloved Jesus, I embrace all the tribulations Thou hast destined for me until death. I beseech Thee, by the merits of the pain Thou didst suffer in carrying Thy Cross, to give me the necessary help to carry mine with perfect patience and resignation. I love Thee, Jesus my love; I repent of having offended Thee. Never permit me to separate myself from Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 3: JESUS FALLS THE FIRST TIME

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider this first fall of Jesus under His Cross. His flesh was torn by the scourges, His head crowned with thorns, and He had lost a great quantity of blood. He was so weakened that he could scarcely walk, and yet he had to carry this great load upon His shoulders. The soldiers struck Him rudely, and thus He fell several times in His journey.

My beloved Jesus, it is not the weight of the Cross, but my sins, which have made Thee suffer so much pain. Ah, by the merits of this first fall, deliver me from the misfortune of falling into mortal sin. I love Thee, O my Jesus, with my whole heart; I repent of having offended Thee. Never permit me to

separate myself from Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 4: JESUS MEETS HIS MOTHER

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider the meeting of the Son and the Mother, which took place on this journey. Jesus and Mary looked at each other, and their looks became as so many arrows to wound those hearts which loved each other so tenderly. My most loving Jesus, by the sorrow Thou didst experience in this meeting, grant me the grace of a truly devoted love for Thy most holy Mother. And thou, my Queen, who wast overwhelmed with sorrow, obtain for me by thy intercession a continual and tender remembrance of the Passion of thy Son. I love Thee, Jesus my love; I repent of ever having

offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 5: JESUS IS HELPED BY SIMON

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how the Jews, seeing that at each step Jesus from weakness was on the point of expiring, and fearing that He would die on the way, when they wished Him to die the ignominious death of the Cross, constrained Simon the Cyrenian to carry the Cross behind our Lord. My most sweet Jesus, I will not refuse the Cross, as the Cyrenian did; I accept it; I embrace it. I accept in particular the death Thou hast destined for me; with all the pains that may accompany it; I unite it to Thy death, I offer it to Thee. Thou hast died for love of me; I will die for love of Thee, and to please Thee. Help me by Thy grace. I love Thee, Jesus my love; I repent of

having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 6: VERONICA WIPES THE FACE OF JESUS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how the holy woman named Veronica, seeing Jesus so afflicted, and His face bathed in sweat and blood, presented Him with a towel, with which He wiped His adorable face, leaving on it the impression of His holy countenance. My most beloved Jesus, Thy face was beautiful before, but in this journey it has lost all its beauty, and wounds and blood have disfigured it. Alas, my soul also was once beautiful, when it received Thy grace in Baptism; but I have disfigured it since by my sins; Thou alone, my Redeemer, canst restore it to its former beauty. Do this by Thy Passion, O

Jesus. I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 7: JESUS FALLS A SECOND TIME

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider the second fall of Jesus under the Cross—a fall which renews the pain of all the wounds of the head and members of our afflicted Lord. My most gentle Jesus, how many times Thou hast pardoned me, and how many times have I fallen again, and begun again to offend Thee! Oh, by the merits of this new fall, give me the necessary help to persevere in Thy grace until death. Grant that in all temptations which assail me I may always commend myself to Thee. I love Thee, Jesus my love; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.

Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 8: JESUS SPEAKS TO THE WOMEN

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how those women wept with compassion at seeing Jesus in such a pitiable state, streaming with blood, as He walked along. But Jesus said to them: Weep not for Me, but for your children. My Jesus, laden with sorrows, I weep for the offences I have committed against Thee, because of the pains they have deserved, and still more because of the displeasure they have caused Thee, who hast loved me so much. It is Thy love, more than the fear of hell, which causes me to weep

for my sins. My Jesus, I love Thee more than myself; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 9: JESUS FALLS A THIRD TIME

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider the third fall of Jesus Christ. His weakness was extreme, and the cruelty of His executioners was excessive, who tried to hasten His steps when He had scarcely strength to move. Ah, my outraged Jesus, by the merits of the weakness Thou didst suffer in going to Calvary, give me strength sufficient to conquer all human respect, and all my wicked passions, which have led me to despise Thy friendship. I love Thee, Jesus my love, with my whole heart; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 10: JESUS IS STRIPPED OF HIS GARMENTS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider the violence with which the executioners stripped Jesus. His inner garments adhered to His torn flesh, and they dragged them off so roughly that the skin came with them. Compassionate your Savior thus cruelly treated, and say to Him: My innocent Jesus, by the merits of the torment Thou hast felt, help me to strip myself of all affection to things of earth, in order that I may place all my love in Thee, who art so worthy of my love. I love Thee, O Jesus, with my whole heart; I repent of having offended Thee. Never permit me to

offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 11: JESUS IS NAILED TO THE CROSS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how Jesus, after being thrown on the Cross extended His hands, and offered to His Eternal Father the sacrifice of His death for our salvation. These barbarians fastened Him with nails, and then, raising the Cross, allowed Him to die with anguish on this infamous gibbet. My Jesus! loaded with contempt, nail my heart to Thy feet, that it may ever remain there, to love Thee, and never quit Thee again. I love Thee more than myself; I repent of having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 12: JESUS DIES ON THE CROSS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how thy Jesus, after three hours’ Agony on the Cross, consumed at length with anguish, abandons Himself to the weight of His body, bows His head, and dies. O my dying Jesus, I kiss devoutly the Cross on which Thou didst die for love of me. I have merited by my sins to die a miserable death; but Thy death is my hope. Ah, by the merits of Thy death, give me grace to die, embracing Thy feet, and burning with love for Thee. I yield my soul into Thy hands. I love Thee with my whole heart; I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt.

Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 13: JESUS IS TAKEN DOWN FROM THE CROSS

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how, after the death of our Lord, two of His disciples, Joseph and Nicodemus, took Him down from the Cross, and placed Him in the arms of His afflicted Mother, who received Him with unutterable tenderness, and pressed Him to her bosom. O Mother of sorrow, for the love of this Son, accept me for thy servant, and pray to Him for me. And Thou, my Redeemer, since Thou hast died for me, permit me to love Thee; for I wish but Thee, and nothing more. I love Thee, my Jesus, and I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die For very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

STATION 14: JESUS IS PLACED IN THE TOMB

V. We adore Thee, O Christ, and we bless Thee. R. Because by Thy holy Cross, Thou hast redeemed the world. Consider how the disciples carried the body of Jesus to bury it, accompanied by His holy Mother, who arranged it in the sepulchre with her own hands. They then closed the tomb, and all withdrew. Oh, my buried Jesus, I kiss the stone that encloses Thee. But Thou didst rise again the third day. I beseech Thee, by Thy resurrection, make me rise glorious with Thee at the last day, to be always united with Thee in heaven, to praise Thee and love Thee forever. I love Thee, and I repent of ever having offended Thee. Never permit me to offend Thee again. Grant that I may love Thee always; and then do with me what Thou wilt. Our Father, Hail Mary and Glory Be. Dear Jesus, Thou dost go to die for very love of me: Ah! let me bear Thee company; I wish to die with Thee. V. Have mercy on us, O Lord. R. Have mercy on us.

St. Alphonsus Liguori, pray for us. Amen.', NULL, 'St. Alphonsus Liguori, The Way of the Cross (public domain)', 9090);
