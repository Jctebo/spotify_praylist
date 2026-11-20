-- v508 migration 0036 — the prayer book: call-and-response line breaks.
-- The fix on the v508 review's findings (release doc v508-prayer-book-
-- call-response.md §2): in each affected body / body_latin, every
-- call-and-response unit now stands on its own line — the opening unit,
-- each R./℟. response, each following V./℣. versicle or versicle-text.
-- THE WORDS DO NOT CHANGE: each text below, with line breaks removed, is
-- word-for-word identical to the text it replaces. Generated from the
-- live book payload by the seam splitter; proven in harness-v508 (the
-- sqlite chain proof + the word-stream identity legs).

UPDATE prayer_book SET body = 'V. The Angel of the Lord declared unto Mary.
R. And she conceived of the Holy Ghost.
Hail, Mary, etc.
V. Behold the handmaid of the Lord.
R. Be it done unto me according to thy word.
Hail, Mary, etc.
V. And the Word was made Flesh.
R. And dwelt among us.
Hail, Mary, etc.
V. Pray for us, O Holy Mother of God.
R. That we may be made worthy of the promises of Christ.
Let us pray. Pour forth, we beseech Thee, O Lord, Thy grace into our hearts; that as we have known the incarnation of Christ Thy Son by the message of an angel, so, by His passion and cross, we may be brought to the glory of His resurrection; through the same Christ our Lord. Amen.' WHERE slug = 'angelus';
UPDATE prayer_book SET body_latin = 'V. Angelus Domini nuntiavit Mariae.
R. Et concepit de Spiritu Sancto.
Ave, Maria, etc.
V. Ecce ancilla Domini.
R. Fiat mihi secundum verbum tuum.
Ave, Maria, etc.
V. Et Verbum caro factum est.
R. Et habitavit in nobis.
Ave, Maria, etc.
V. Ora pro nobis, sancta Dei Genitrix.
R. Ut digni efficiamur promissionibus Christi.
Oremus. Gratiam tuam, quaesumus, Domine, mentibus nostris infunde, ut qui, Angelo nuntiante, Christi filii tui incarnationem cognovimus, per passionem ejus et crucem ad resurrectionis gloriam perducamur; per eumdem Christum Dominum nostrum. Amen.' WHERE slug = 'angelus';
UPDATE prayer_book SET body = 'During Eastertide, from Holy Saturday till Trinity Sunday, instead of the Angelus, the Regina Caeli is recited standing.

Queen of heaven, rejoice, Alleluia. For He Whom thou didst deserve to bear, Alleluia. Hath risen as He said, Alleluia. Pray for us to God, Alleluia.
V. Rejoice and be glad, O Virgin Mary! Alleluia.
R. Because Our Lord is truly risen, Alleluia.
Let us pray. O God, Who by the resurrection of Thy Son, Our Lord Jesus Christ, hast vouchsafed to make glad the whole world, grant, we beseech Thee, that, through the intercession of the Virgin Mary, His mother, we may attain the joys of eternal life. Through the same Christ our Lord. Amen.' WHERE slug = 'regina-caeli';
UPDATE prayer_book SET body_latin = 'Regina coeli, laetare, Alleluia. Quia quem meruisti portare, Alleluia. Resurrexit, sicut dixit, Alleluia. Ora pro nobis Deum, Alleluia.
V. Gaude et laetare, Virgo Maria, Alleluia.
R. Quia surrexit Dominus vere, Alleluia.
Oremus. Deus, qui per resurrectionem Filii tui, Domini nostri, Jesu Christi, mundum laetificare dignatus es, praesta, quaesumus, ut per ejus genitricem Virginem Mariam perpetuae capiamus gaudia vitae: per eumdem Christum, Dominum nostrum.
R. Amen.' WHERE slug = 'regina-caeli';
UPDATE prayer_book SET body = 'Hail, holy queen, mother of mercy, our life, our sweetness, and our hope; to thee do we cry, poor banished sons of Eve, to thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy toward us, and after this, our exile, show unto us the blessed fruit of thy womb, Jesus, O clement, O loving, O sweet Virgin Mary!
V. Make me worthy to praise thee, holy Virgin.
R. Give me strength against thine enemies.
V. Blessed be God in his saints.
R. Amen.' WHERE slug = 'hail-holy-queen';
UPDATE prayer_book SET body_latin = 'Salve regina, mater misericordiae, vita dulcedo, et spes nostra salve. Ad te clamamus exules filii Hevae; ad te suspiramus, gementes et flentes in hac lacrymarum valle. Eja ergo, advocata nostra, illos tuos misericordes oculos ad nos converte; et Jesum benedictum fructum ventris tui nobis post hoc exilium ostende, O Clemens, O pia, O dulcis virgo Maria.
V. Dignare me laudare te, virgo sacrata.
R. Da mihi virtutem contra hostes tuos.
V. Benedictus Deus in Sanctis suis.
R. Amen.' WHERE slug = 'hail-holy-queen';
UPDATE prayer_book SET body = 'I believe in God, the Father Almighty, Creator of heaven and earth; and in Jesus Christ, His only Son, our Lord: Who was conceived by the Holy Ghost, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; the third day He rose again from the dead; He ascended into heaven, sitteth at the right hand of God, the Father Almighty; from thence He shall come to judge the living and dead. I believe in the Holy Ghost, the holy Catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and the life everlasting. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.

Hail, holy queen, mother of mercy, our life, our sweetness, and our hope; to thee do we cry, poor banished sons of Eve, to thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy toward us, and after this, our exile, show unto us the blessed fruit of thy womb, Jesus, O clement, O loving, O sweet Virgin Mary!
V. Make me worthy to praise thee, holy Virgin.
R. Give me strength against thine enemies.
V. Blessed be God in his saints.
R. Amen.' WHERE slug = 'the-rosary-prayers';
UPDATE prayer_book SET body_latin = 'Credo in Deum, Patrem omnipotentem, Creatorem coeli et terrae; et in Jesum Christum, Filium ejus unicum, Dominum nostrum: qui conceptus est de Spiritu Sancto, natus ex Maria Virgine, passus sub Pontio Pilato, crucifixus, mortuus, et sepultus. Descendit ad inferos; tertia die resurrexit a mortuis; ascendit ad coelos, sedet ad dexteram Dei Patris omnipotentis; inde venturus est judicare vivos et mortuos. Credo in Spiritum Sanctum, Sanctam Ecclesiam Catholicam, sanctorum communionem, remissionem peccatorum, carnis resurrectionem, vitam aeternam. Amen.

Pater noster, qui es in coelis, sanctificetur nomen tuum: adveniat regnum tuum: fiat voluntas tua, sicut in coelo, et in terra. Panem nostrum quotidianum da nobis hodie: et dimitte nobis debita nostra, sicut et nos dimittimus debitoribus nostris. Et ne nos inducas in tentationem: sed libera nos a malo. Amen.

Ave, Maria, gratia plena; Dominus tecum; benedicta tu in mulieribus, et benedictus fructus ventris tui, Jesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.

Gloria Patri, et Filio, et Spiritui Sancto. Sicut erat in principio, et nunc, et semper: et in saecula saeculorum. Amen.

Salve regina, mater misericordiae, vita dulcedo, et spes nostra salve. Ad te clamamus exules filii Hevae; ad te suspiramus, gementes et flentes in hac lacrymarum valle. Eja ergo, advocata nostra, illos tuos misericordes oculos ad nos converte; et Jesum benedictum fructum ventris tui nobis post hoc exilium ostende, O Clemens, O pia, O dulcis virgo Maria.
V. Dignare me laudare te, virgo sacrata.
R. Da mihi virtutem contra hostes tuos.
V. Benedictus Deus in Sanctis suis.
R. Amen.' WHERE slug = 'the-rosary-prayers';
UPDATE prayer_book SET body = 'Lord, have mercy on us.
Christ, have mercy on us.
Lord, have mercy on us.
Christ, hear us.
Christ, graciously hear us.
God, the Father of heaven, Have mercy on us.
God, the Son, Redeemer of the world, Have mercy on us.
God, the Holy Ghost, Have mercy on us.
Holy Trinity, one God, Have mercy on us.

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
May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.' WHERE slug = 'litany-of-loreto';
UPDATE prayer_book SET body = 'We fly to thy patronage, O holy Mother of God; despise not our petitions in our necessities, but deliver us from all dangers, O ever glorious and blessed Virgin.
V. Make me worthy to praise thee, holy Virgin.
R. Give me strength against thine enemies.
V. Blessed be God in his saints.
R. Amen.' WHERE slug = 'sub-tuum-praesidium';
UPDATE prayer_book SET body_latin = 'Sub tuum praesidium confugimus, sancta Dei genitrix; nostras deprecationes ne despicias in necessitatibus nostris, sed a periculis cunctis libera nos, semper virgo gloriosa et benedicta.
V. Dignare me laudare te, virgo sacrata.
R. Da mihi virtutem contra hostes tuos.
V. Benedictus Deus in Sanctis suis.
R. Amen.' WHERE slug = 'sub-tuum-praesidium';
UPDATE prayer_book SET body = 'Bless us, O Lord, and these Thy gifts which we are about to receive from Thy bounty: through Christ Our Lord.
R. Amen.' WHERE slug = 'grace-before-meals';
UPDATE prayer_book SET body = 'We give Thee thanks, almighty God, for all Thy benefits, Who livest and reignest world without end.
R. Amen.
Vouchsafe, O Lord, to reward with eternal life all those who do us good for Thy name''s sake.
R. Amen.
V. Let us bless the Lord.
R. Thanks be to God.
V. May the souls of the faithful departed, through the mercy of God, rest in peace.
R. Amen.' WHERE slug = 'grace-after-meals';
