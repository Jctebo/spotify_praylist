-- v482 migration 0029 — the prayer book grows: ten additions and
-- an eighth group, "For the children" (Plan §2.1 of the v482
-- release document; approval record 29, decisions D1-D4 A).
-- Source: Fr. F. X. Lasance, "My Prayer Book" (Benziger
-- Brothers, 1908; public domain) — the same edition migrations
-- 0006 and 0026 seeded from (Internet Archive item
-- MyPrayerBookHappinessInGoodness). Text is seeded verbatim
-- (the book's own paragraphing; only scan/OCR artifacts
-- cleaned — spacing, ligature and OCR misreads, hyphenated
-- line-breaks, drop-cap initials the scan loses — wording
-- never modernized). The source named on each row carries the
-- page the text stands on. body_latin stands only where the
-- book prints the Latin for that prayer; NULL paints no
-- toggle. Recitation rubrics and indulgence notes printed
-- around a prayer are directions, not prayer text, and are
-- not seeded. INSERT-only: no standing row is touched, no
-- slug changes; the eighth group stands by its category and
-- its 8xxx sort band (the book payload groups by consecutive
-- category in sort order — no client or schema change).
INSERT INTO prayer_book (slug, title, category, body, body_latin, source, sort) VALUES
  ('te-deum', 'Te Deum', 'Daily', 'We praise Thee, O God; we acknowledge Thee to be our Lord. All the earth worships Thee, the Father everlasting. To Thee all the angels cry aloud; the heavens, and all the heavenly powers, To Thee the cherubim and seraphim continually do cry: Holy, holy, holy, Lord God of Sabaoth. Heaven and earth are full of the majesty of Thy glory. The glorious choir of the apostles praises Thee. The admirable company of the prophets praises Thee. The noble army of the martyrs praises Thee. The holy Church throughout the world acknowledges Thee. The Father of infinite majesty; Thy adorable, true, and only Son; Also, the Holy Ghost, the Comforter. Thou, O Christ, art the King of glory. Thou art the everlasting Son of the Father. When Thou didst take upon Thee to deliver man, Thou didst not disdain the Virgin''s womb. Having overcome the sting of death, Thou didst open the kingdom of heaven to all believers. Thou sittest at the right hand of God, in the glory of the Father. We believe that Thou shalt come to be our Judge. We therefore pray Thee to help Thy servants, whom Thou hast redeemed with Thy precious blood. Make them to be numbered with Thy saints in glory everlasting. Save Thy people, O Lord, and bless Thy inheritance. Govern them, and raise them up forever. Every day we bless Thee. And we praise Thy name forever; yea, forever and ever. Vouchsafe, O Lord, this day, to keep us from sin. Have mercy on us, O Lord, have mercy on us. Let Thy mercy, O Lord, be upon us, as we have hoped in Thee. In Thee, O Lord, I have hoped; let me never be confounded.', 'Te Deum laudamus: Te Dominum confitemur. Te aeternum Patrem, omnis terra veneratur. Tibi omnes angeli: tibi coeli et universae potestates: Tibi cherubim et seraphim incessabili voce proclamant: Sanctus, sanctus, sanctus, Dominus Deus Sabaoth. Pleni sunt coeli et terra majestatis gloriae tuae. Te gloriosus apostolorum chorus: Te prophetarum laudabilis numerus: Te martyrum candidatus laudat exercitus. Te per orbem terrarum sancta confitetur Ecclesia. Patrem immensae majestatis; Venerandum tuum verum et unicum Filium; Sanctum quoque Paraclitum Spiritum. Tu Rex gloriae, Christe. Tu Patris sempiternus es Filius. Tu ad liberandum suscepturus hominem, non horruisti Virginis uterum. Tu devicto mortis aculeo, aperuisti credentibus regna coelorum. Tu ad dexteram Dei sedes in gloria Patris. Judex crederis esse venturus. Te ergo quaesumus, tuis famulis subveni, quos pretioso sanguine redemisti. Aeterna fac cum Sanctis tuis in gloria numerari. Salvum fac populum tuum, Domine, et benedic haereditati tuae. Et rege eos, et extolle illos usque in aeternum. Per singulos dies benedicimus Te. Et laudamus nomen tuum in saeculum, et in saeculum saeculi. Dignare, Domine, die isto, sine peccato nos custodire. Miserere nostri, Domine, miserere nostri. Fiat misericordia tua, Domine, super nos: quemadmodum speravimus in Te. In Te, Domine, speravi; non confundar in aeternum.', 'Lasance, My Prayer Book (1908), pp. 438-439', 1110),
  ('prayer-before-a-crucifix', 'St. Thomas Aquinas'' Prayer Before a Crucifix', 'Daily', 'Grant me grace, O merciful God, to desire ardently all that is pleasing to Thee, to examine it prudently, to acknowledge it truthfully, and to accomplish it perfectly, for the praise and glory of Thy name. Amen.', 'Concede mihi, misericors Deus, quae tibi placita sunt ardenter concupiscere, prudenter investigare, veraciter agnoscere et perfecte adimplere, ad laudem et gloriam nominis tui. Amen.', 'Lasance, My Prayer Book (1908), p. 228', 1120),
  ('act-of-reparation-to-the-sacred-heart', 'Act of Reparation to the Sacred Heart', 'Daily', 'Adorable Heart of Jesus, glowing with love for us and inflamed with zeal for our salvation: O Heart! ever sensible of our misery and the wretchedness to which our sins have reduced us, infinitely rich in mercy to heal the wounds of our souls, behold us humbly prostrate before Thee to express the sorrow that fills our hearts for the coldness and indifference with which we have so long requited the numberless benefits that Thou hast conferred upon us. With a deep sense of the outrages that have been heaped upon Thee by our sins and the sins of others, we come to make a solemn reparation of honor to Thy most sacred majesty. It was our sins that overwhelmed Thy Heart with bitterness; it was the weight of our iniquities that pressed down Thy face to the earth in the Garden of Olives, and caused Thee to expire in anguish and agony on the cross. But now, repenting and sorrowful, we cast ourselves at Thy feet, and implore forgiveness. Adorable Heart of Jesus, source of true contrition and ever merciful to the penitent sinner, impart to our hearts the spirit of penance, and give to our eyes a fountain of tears, that we may sincerely bewail our sins now and for the rest of our days. Oh, would that we could blot them out, even with our blood! Pardon them, O Lord, in Thy mercy, and pardon and convert to Thee all that have committed irreverences and sacrileges against Thee in the sacrament of Thy love, and thus give another proof that Thy mercy is above all Thy works. Divine Jesus, with Thee there are mercy and plentiful redemption; deliver us from our sins, accept the sincere desire we now entertain, and our holy resolution, relying on the assistance of Thy grace, henceforth to be faithful to Thee. And in order to repair the sins of ingratitude by which we have grieved Thy most tender and loving Heart, we are resolved in the future ever to love and honor Thee in the most adorable Sacrament of the Altar, where Thou art ever present to hear and grant our petitions, and to be the food and life of our souls. Be Thou, O compassionate Jesus! our Mediator with Thy heavenly Father, Whom we have so grievously offended, strengthen our weakness, confirm these our resolutions of amendment, and as Thy sacred Heart is our refuge and our hope when we have sinned, so may it be the strength and support of our repentance, that nothing in life or death may ever again separate us from Thee. Amen.', NULL, 'Lasance, My Prayer Book (1908), pp. 517-518', 1130),
  ('litany-of-loreto', 'Litany of Loreto', 'Our Lady', 'Lord, have mercy on us. Christ, have mercy on us. Lord, have mercy on us. Christ, hear us. Christ, graciously hear us. God, the Father of heaven, Have mercy on us. God, the Son, Redeemer of the world, Have mercy on us. God, the Holy Ghost, Have mercy on us. Holy Trinity, one God, Have mercy on us.

Holy Mary, pray for us.
Holy Mother of God, pray for us.
Holy Virgin of virgins, pray for us.
Mother of Christ, pray for us.
Mother of divine grace, pray for us.
Mother most pure, pray for us.
Mother most chaste, pray for us.
Mother inviolate, pray for us.
Mother undefiled, pray for us.
Mother most amiable, pray for us.
Mother most admirable, pray for us.
Mother of good counsel, pray for us.
Mother of our Creator, pray for us.
Mother of our Saviour, pray for us.
Virgin most prudent, pray for us.
Virgin most venerable, pray for us.
Virgin most renowned, pray for us.
Virgin most powerful, pray for us.
Virgin most merciful, pray for us.
Virgin most faithful, pray for us.
Mirror of justice, pray for us.
Seat of wisdom, pray for us.
Cause of our joy, pray for us.
Spiritual vessel, pray for us.
Vessel of honor, pray for us.
Singular vessel of devotion, pray for us.
Mystical rose, pray for us.
Tower of David, pray for us.
Tower of ivory, pray for us.
House of gold, pray for us.
Ark of the covenant, pray for us.
Gate of heaven, pray for us.
Morning star, pray for us.
Health of the sick, pray for us.
Refuge of sinners, pray for us.
Comforter of the afflicted, pray for us.
Help of Christians, pray for us.
Queen of angels, pray for us.
Queen of patriarchs, pray for us.
Queen of prophets, pray for us.
Queen of apostles, pray for us.
Queen of martyrs, pray for us.
Queen of confessors, pray for us.
Queen of virgins, pray for us.
Queen of all saints, pray for us.
Queen conceived without original sin, pray for us.
Queen of the most holy Rosary, pray for us.
Queen of peace, pray for us.

Lamb of God, Who takest away the sins of the world, spare us, O Lord!
Lamb of God, Who takest away the sins of the world, graciously hear us, O Lord!
Lamb of God, Who takest away the sins of the world, have mercy on us!
V. Pray for us, O holy Mother of God,
R. That we may be made worthy of the promises of Christ.
Let us pray.
Pour forth, we beseech Thee, O Lord, Thy grace into our hearts; that we, to whom the incarnation of Christ Thy Son was made known by the message of an angel, may, by His passion and cross, be brought to the glory of His resurrection; through the same Christ our Lord. Amen.
May the divine assistance remain always with us.
May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.', NULL, 'Lasance, My Prayer Book (1908), pp. 465-467', 4040),
  ('sub-tuum-praesidium', 'Sub Tuum Praesidium', 'Our Lady', 'We fly to thy patronage, O holy Mother of God; despise not our petitions in our necessities, but deliver us from all dangers, O ever glorious and blessed Virgin. V. Make me worthy to praise thee, holy Virgin. R. Give me strength against thine enemies. V. Blessed be God in his saints. R. Amen.', 'Sub tuum praesidium confugimus, sancta Dei genitrix; nostras deprecationes ne despicias in necessitatibus nostris, sed a periculis cunctis libera nos, semper virgo gloriosa et benedicta. V. Dignare me laudare te, virgo sacrata. R. Da mihi virtutem contra hostes tuos. V. Benedictus Deus in Sanctis suis. R. Amen.', 'Lasance, My Prayer Book (1908), p. 223', 4050),
  ('prayer-to-our-lady-of-sorrows', 'Prayer to Our Lady of Sorrows', 'Our Lady', 'O Mary! I beseech thee by the sorrows thou didst experience in beholding thy divine Son dying on the cross, procure for me a good death; obtain for me that, having loved Jesus and thee, my most tender Mother, here on earth, I may love you both and bless you eternally in heaven. Amen.', NULL, 'Lasance, My Prayer Book (1908), p. 553', 4060),
  ('prayer-to-st-anthony', 'Prayer to St. Anthony for Lost Things', 'In trouble', 'If, then, you ask for miracles,
Death, error, all calamities,
The leprosy, and demons flee,
And health succeeds infirmities.
The sea obeys, and fetters break;
And lifeless limbs thou dost restore;
Whilst treasures lost are found again,
When young or old thine aid implore.
All dangers vanish at thy prayer,
And direst need doth quickly flee;
Let those who know thy power proclaim,
Let Paduans say: These are of thee.
The sea obeys, and fetters break;
And lifeless limbs thou dost restore;
Whilst treasures lost are found again,
When young or old thine aid implore.
To Father, Son, may glory be,
And Holy Ghost, eternally.
The sea obeys, etc.
V. Pray for us, blessed Anthony.
R. That we may be made worthy of the promises of Christ.
Let us pray.
O God, may the votive commemoration of blessed Anthony, Thy confessor, be a source of joy to Thy Church, that she may always be fortified with spiritual assistance, and deserve to enjoy eternal rewards. Through Christ our Lord. Amen.', 'Si quaeris miracula,
Mors, error, calamitas,
Daemon, lepra fugiunt,
Aegri surgunt sani.
Cedunt mare, vincula;
Membra resque perditas
Petunt et accipiunt
Juvenes et cani.
Pereunt pericula,
Cessat et necessitas;
Narrent hi, qui sentiunt,
Dicant Paduani.
Cedunt mare, vincula;
Membra resque perditas
Petunt et accipiunt
Juvenes et cani.
Gloria Patri et Filio,
Et Spiritui Sancto.
Cedunt mare, vincula, etc.
V. Ora pro nobis, beate Antoni.
R. Ut digni efficiamur promissionibus Christi.
Oremus.
Ecclesiam tuam, Deus, beati Antonii confessoris tui commemoratio votiva laetificet, ut spiritualibus semper muniatur auxiliis, et gaudiis perfrui mereatur aeternis. Per Christum Dominum nostrum. Amen.', 'Lasance, My Prayer Book (1908), pp. 603-605', 5050),
  ('prayer-for-all-the-faithful-departed', 'Prayer for All the Faithful Departed', 'For the dead', 'O God, the Creator and Redeemer of all the faithful, grant to the souls of Thy servants departed the remission of all their sins, that through pious supplications they may obtain that pardon which they have always desired, Who livest and reignest now and forever. Amen.', NULL, 'Lasance, My Prayer Book (1908), p. 216', 7050),
  ('childs-guardian-angel', 'Prayer to the Guardian Angel', 'For the children', 'Angel of God, my guardian dear,
To whom His love commits me here,
Ever this day be at my side,
To light and guard, to rule and guide. Amen.', NULL, 'Lasance, My Prayer Book (1908), p. 210', 8010),
  ('childs-act-of-contrition', 'Act of Contrition', 'For the children', 'Eternal Father! I am heartily sorry for having offended Thee, and I detest all my sins, because I dread the loss of heaven and the pains of hell, but most of all because they displease Thee, my God, Who art all-good and deserving of all my love. I firmly resolve, with the help of Thy grace, to confess my sins, to do penance, and to amend my life.', NULL, 'Lasance, My Prayer Book (1908), p. 351', 8020);
