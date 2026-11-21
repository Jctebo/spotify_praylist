-- v572 (0043): prayer completion — abbreviated and repeated prayers stand in full.
-- UPDATEs prayer_book body/body_latin for the six slugs whose texts change;
-- expansions are the book's own full forms (release doc §2.1 census).

UPDATE prayer_book SET body = 'V. The Angel of the Lord declared unto Mary.
R. And she conceived of the Holy Ghost.
Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
V. Behold the handmaid of the Lord.
R. Be it done unto me according to thy word.
Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
V. And the Word was made Flesh.
R. And dwelt among us.
Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
V. Pray for us, O Holy Mother of God.
R. That we may be made worthy of the promises of Christ.
Let us pray. Pour forth, we beseech Thee, O Lord, Thy grace into our hearts; that as we have known the incarnation of Christ Thy Son by the message of an angel, so, by His passion and cross, we may be brought to the glory of His resurrection; through the same Christ our Lord. Amen.' WHERE slug = 'angelus';
UPDATE prayer_book SET body_latin = 'V. Angelus Domini nuntiavit Mariae.
R. Et concepit de Spiritu Sancto.
Ave, Maria, gratia plena; Dominus tecum; benedicta tu in mulieribus, et benedictus fructus ventris tui, Jesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.
V. Ecce ancilla Domini.
R. Fiat mihi secundum verbum tuum.
Ave, Maria, gratia plena; Dominus tecum; benedicta tu in mulieribus, et benedictus fructus ventris tui, Jesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.
V. Et Verbum caro factum est.
R. Et habitavit in nobis.
Ave, Maria, gratia plena; Dominus tecum; benedicta tu in mulieribus, et benedictus fructus ventris tui, Jesus. Sancta Maria, Mater Dei, ora pro nobis peccatoribus, nunc et in hora mortis nostrae. Amen.
V. Ora pro nobis, sancta Dei Genitrix.
R. Ut digni efficiamur promissionibus Christi.
Oremus. Gratiam tuam, quaesumus, Domine, mentibus nostris infunde, ut qui, Angelo nuntiante, Christi filii tui incarnationem cognovimus, per passionem ejus et crucem ad resurrectionis gloriam perducamur; per eumdem Christum Dominum nostrum. Amen.' WHERE slug = 'angelus';

UPDATE prayer_book SET body = 'My soul doth magnify: the Lord. And my spirit hath rejoiced: in God my Saviour.

For He hath regarded the humility of his handmaid: for behold from henceforth all generations shall call me blessed.

For He that is mighty hath done great things unto me: and holy is his name.

And his mercy is from generation to generation: unto them that fear Him.

He hath shewed strength with his arm: He hath scattered the proud in the imagination of their heart.

He hath put down the mighty from their seat: and hath exalted the humble.

He hath filled the hungry with good things: and the rich He hath sent empty away.

He hath upholden his servant Israel: being mindful of his mercy.

As He spake unto our fathers: to Abraham and his seed for ever.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.' WHERE slug = 'the-magnificat';
UPDATE prayer_book SET body_latin = 'Magnificat: * anima mea Dominum. Et exultavit spiritus meus: * in Deo salutari meo.

Quia respexit humilitatem ancillæ suæ: * ecce enim ex hoc beatam me dicent omnes generationes.

Quia fecit mihi magna qui potens est: * et sanctum nomen ejus.

Et misericordia ejus a progenie in progenies: * timentibus eum.

Fecit potentiam in brachio suo: * dispersit superbos mente cordis sui.

Deposuit potentes de sede: * et exaltavit humiles.

Esurientes implevit bonis: * et divites dimisit inanes.

Suscepit Israel puerum suum: * recordatus misericordiæ suæ.

Sicut locutus est ad patres nostros: * Abraham, et semini ejus in sæcula.

Gloria Patri, et Filio, et Spiritui Sancto. Sicut erat in principio, et nunc, et semper: et in saecula saeculorum. Amen.' WHERE slug = 'the-magnificat';

UPDATE prayer_book SET body = 'If, then, you ask for miracles,
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
The sea obeys, and fetters break;
And lifeless limbs thou dost restore;
Whilst treasures lost are found again,
When young or old thine aid implore.
V. Pray for us, blessed Anthony.
R. That we may be made worthy of the promises of Christ.
Let us pray.
O God, may the votive commemoration of blessed Anthony, Thy confessor, be a source of joy to Thy Church, that she may always be fortified with spiritual assistance, and deserve to enjoy eternal rewards. Through Christ our Lord. Amen.' WHERE slug = 'prayer-to-st-anthony';
UPDATE prayer_book SET body_latin = 'Si quaeris miracula,
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
Cedunt mare, vincula;
Membra resque perditas
Petunt et accipiunt
Juvenes et cani.
V. Ora pro nobis, beate Antoni.
R. Ut digni efficiamur promissionibus Christi.
Oremus.
Ecclesiam tuam, Deus, beati Antonii confessoris tui commemoratio votiva laetificet, ut spiritualibus semper muniatur auxiliis, et gaudiis perfrui mereatur aeternis. Per Christum Dominum nostrum. Amen.' WHERE slug = 'prayer-to-st-anthony';

UPDATE prayer_book SET body = 'This Chaplet consists of seven Mysteries, in which we meditate upon the seven times in which Jesus Christ shed his Blood for us; at each Mystery except the last we say Pater noster five times, and Gloria Patri once; and at the last, Pater noster thrice, and Gloria Patri once; thus making up the number of 33, by saying the Pater noster thirty-three times in remembrance of the thirty-three years of our Lord''s life. End with the prayer, "Most Precious Blood," etc.

N.B.—These Indulgences can be gained by merely saying thirty-three Pater nosters and, if the person is capable of meditating, reflecting on the Mysteries.

THE CHAPLET

℣. O God, come to my assistance.
℟. O Lord, make haste to help me.
℣. Glory be to the Father, and to the Son, and to the Holy Ghost.
℟. As it was in the beginning, is now, and ever shall be, world without end. Amen.

First Mystery.

The first time our loving Saviour shed his Precious Blood for us was on the eighth day after his birth, when he was circumcised in order to fulfil the law of Moses. While, then, we reflect that Jesus did this to satisfy the justice of God for our lax ways, let us rouse ourselves to sorrow for them, and promise, with the help of his all-powerful grace, to be henceforth truly chaste in body and in soul.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Second Mystery.

Next, in the Garden of Olives, Jesus shed his Blood for us in such quantity that it bathed the earth around. He did this at the sight of the ingratitude with which men would meet his love. Let us, then, repent sincerely that we have hitherto corresponded so ill with the countless blessings of God, and resolve to make good use of his graces and inspirations.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Third Mystery.

Next, in his cruel scourging, Jesus shed his Blood when his flesh was so torn that streams of Blood flowed from every part of his body, all of which he offered all the time to his Eternal Father in payment of our impatience and our softness. How comes it, then, that we do not curb our anger and love of self? Henceforth we will try our best to bear our troubles well, and, despising self, take peacefully the injuries which men may do us.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Fourth Mystery.

Again, from the sacred Head of Jesus, Blood poured down when it was crowned with thorns, in punishment of our pride and evil thoughts. Shall we, then, continue to nurture haughtiness, foster foul imaginations, and feed the wayward will within us? Henceforth let there be ever before our eyes our utter nothingness, our misery, and our weakness; and with generous hearts let us resist all the temptations of the devil.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Fifth Mystery.

What streams of Precious Blood did not our loving Lord pour forth from his veins when laden with the heavy Cross on that most grievous journey to Calvary! The very streets and ways of Jerusalem, through which He passed, were watered with it! This He did in satisfaction for the scandals and bad example by which his own creatures had led others astray. Who can tell how many of us are of this unhappy number? Who knows how many he himself alone has, by his own bad example, brought down to hell? And what have we done to remedy this evil? Henceforth let us at least do all we can to save souls by word and by example, making ourselves a pattern to all of goodness and a holy life.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Sixth Mystery.

More, and still more Precious Blood did the Redeemer of mankind shed in his barbarous Crucifixion; when, his veins being rent and arteries burst, there rushed forth in a torrent, from his hands and his feet, that saving balm of life eternal, to pay for all the crimes and enormities of a lost world. Who, after this, would continue in sin, and so renew the cruel crucifixion of the Son of God? Let us weep bitterly for our bad deeds done, and detest them before the feet of the sacred minister of God; let us amend our evil ways, and henceforth begin a truly Christian life, with the remembrance ever in our hearts of all the Blood which our salvation cost the Saviour of men.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Seventh Mystery.

Last of all, after his death, when his sacred Side was opened by the lance, and his loving Heart was wounded, Jesus shed Blood, and with it there came forth water, to show us how his Blood was all poured out to the last drop for our salvation. Oh, the great goodness of our redeeming Lord! Who will not love Thee, Saviour of my soul? What heart will not consume itself away for love of Thee, who hast done all this for our redemption? The tongue wants words to praise Thee; so let us invite all creatures upon earth, all angels and all saints in Paradise, and most of all our dear Mother Mary, to bless, praise, and celebrate thy most Precious Blood. Glory to the Blood of Jesus! Now and ever throughout all ages. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Glory be to the Father, and to the Son, and to the Holy Ghost. As it was in the beginning, is now, and ever shall be, world without end. Amen.
℣. We beseech Thee, therefore, help thy servants, whom Thou hast redeemed with thy Precious Blood.

Prayer.

Most Precious Blood of life eternal! price and ransom of the world! drink and bath of the soul! ever pleading the cause of man before the throne of Mercy; I adore Thee most profoundly; I would, if I were able, make Thee some compensation for the outrages and wrongs Thou dost ever suffer from men, and especially from those who dare in their rashness to blaspheme Thee. Who will not bless this Blood of value infinite? who does not feel himself on fire with the love of Jesus, who shed it all for us? What should I be but for this Blood, which hath redeemed me? And what drew Thee, Thou Precious Blood, from the veins of my Lord, even to the last drop? It was love. O boundless love, which gave to us this saving balsam! O balsam beyond all price, streaming forth from the fount of immeasurable love! Give to all hearts, all tongues, power to praise, celebrate, and thank Thee, now and ever, and throughout all eternity. Amen.

℣. Thou hast redeemed us, O Lord, with thy Blood.
℟. And hast made us a kingdom to our God.

Let us pray.

Almighty and everlasting God, who hast appointed thine only-begotten Son the Saviour of the world, and hast willed to be appeased by his Blood; grant us, we beseech Thee, so to venerate this Blood, the price of our salvation, and so to be defended on earth by its power from the evils of this present life, that in heaven we may be made glad by its everlasting fruit. Who liveth and reigneth with Thee in the unity of the Holy Ghost, God, world without end. Amen.' WHERE slug = 'chaplet-of-the-precious-blood';
UPDATE prayer_book SET body_latin = '℣. Deus, in adjutorium meum intende.
℟. Domine, ad adjuvandum me festina.
℣. Gloria Patri, et Filio, et Spiritui Sancto.
℟. Sicut erat in principio, et nunc, et semper: et in saecula saeculorum. Amen.

℣. Te ergo quæsumus tuis famulis subveni quos pretioso Sanguine redemisti.

℣. Te ergo quæsumus tuis famulis subveni quos pretioso Sanguine redemisti. (repeated after the Second, Third, Fourth, Fifth, Sixth and Seventh Mysteries)

℣. Redemisti nos, Domine, in Sanguine tuo:
℟. Et fecisti nos Deo nostro regnum.

Oremus.

Omnipotens sempiterne Deus, qui unigenitum Filium tuum mundi Redemptorem constituisti, ac ejus Sanguine placari voluisti; concede nobis, quæsumus, salutis nostræ pretium ita venerari, atque a præsentis vitæ malis ejus virtute defendi in terris, ut fructu perpetuo lætemur in cælis. Qui tecum vivit et regnat in unitate Spiritus Sancti, Deus, per omnia sæcula sæculorum. Amen.' WHERE slug = 'chaplet-of-the-precious-blood';

UPDATE prayer_book SET body = 'This Chaplet consists of seven divisions, in memory of our Lady''s seven sorrows, on which we are to meditate, if we can, saying the Pater noster once and the Ave Maria seven times at each division, then ending with Ave thrice in honour of our Lady''s tears.

Way of Saying the Chaplet.
Act of Contrition.
O My Lord, Thou who alone art most worthy of my love, behold me standing before thy Divine Presence utterly overwhelmed by the thought of the many grievous injuries I have done Thee. I ask thy pardon for them with my whole heart, repenting of them purely for love of Thee, and at the thought of thy great goodness hating and loathing them above every evil of this life. As I would rather have died a thousand times than have offended Thee, so now I am most firmly resolved to die a thousand deaths rather than offend Thee again. My crucified Jesus, I firmly purpose to cleanse my soul as soon as possible by thy most Precious Blood in the Sacrament of Penance. And thou, most tender Virgin, Mother of mercy and Refuge of sinners, do thou obtain for me by virtue of thy bitter pains, the pardon of sin which I desire; whilst, praying according to the mind of so many holy Pontiffs in order to obtain the Indulgences granted to this thy holy Rosary, I hope thereby to obtain remission of all pains due to my sins.

With this confidence in my heart, I meditate on the First Sorrow, when Mary, Virgin Mother of my God, presented Jesus her only Son in the Temple, laid Him in the arms of holy and aged Simeon, and heard his prophetic word, "The sword of grief shall pierce thy soul," foretelling thereby the Passion and Death of her Son Jesus.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Second Sorrow of the Blessed Virgin was when she was obliged to fly into Egypt by reason of the persecution of cruel Herod, who impiously sought to slay her well beloved Son.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Third Sorrow of the Blessed Virgin was when, after having gone up to Jerusalem at the Paschal Feast with Joseph her spouse and Jesus her beloved Son, she lost Him on the way back to her poor house, and for three days bewailed the loss of her only Love.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Fourth Sorrow of the Blessed Virgin was when she met her dear Son Jesus carrying to Mount Calvary on his tender shoulders the heavy Cross whereon He was to be crucified for our salvation.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Fifth Sorrow of the Blessed Virgin was when she saw her Son Jesus raised upon the hard tree of the Cross, and blood flowing from every part of his sacred Body, and then beheld Him die after three hours'' agony.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Sixth Sorrow of the Blessed Virgin was when she saw the lance pierce the sacred Side of Jesus, her beloved Son, the nails withdrawn, and his holy Body laid in her purest bosom.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

The Seventh and last Sorrow of the Blessed Virgin, Queen and Advocate of us, her servants, miserable sinners, was when she saw the holy Body of her Son buried in the grave.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Then say, in veneration of the tears which Mary shed in her sorrows, to obtain thereby true sorrow for sins and the holy Indulgences attached to this pious exercise:

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.

V. Pray for us, Virgin most sorrowful.
R. That we may be made worthy of the promises of Christ.
Let us pray.
Grant, we beseech Thee, O Lord Jesus Christ, that the most blessed Virgin Mary, thy Mother, may intercede for us before the throne of thy mercy, now and at the hour of our death, whose most holy soul was transfixed with the sword of sorrow in the hour of thine own Passion. Through Thee, Jesus Christ, Saviour of the world, who livest and reignest with Thee in the unity of the Holy Ghost, God, world without end. Amen.' WHERE slug = 'rosary-of-the-seven-dolours';

UPDATE prayer_book SET body = 'This Rosary is composed of the Pater, said thirty-three times in remembrance of the thirty-three years He lived on earth, and of the Ave five times in honour of his five most holy wounds; the first three of which are said, one at the beginning of each of the three divisions comprising the Pater said ten times; of the two remaining one Ave is said before saying Pater noster thrice in conclusion, and the other after saying them. This Rosary finishes with the Credo in honour of the holy Apostles.

Begin with an act of contrition.

FIRST DECADE.
THE Archangel Gabriel makes known to Mary the Incarnation of the Divine Word in her pure womb.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
1. The SON of GOD made man is born of Mary the Virgin in a stable.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
2. The Angels rejoice and sing Gloria in excelsis Deo.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
3. The shepherds hear the Angels'' tidings, and come and adore Him.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
4. He is circumcised the eighth day, and called by the most holy Name of JESUS.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
5. Is adored by the Magi with offerings of gold, frankincense, and myrrh.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
6. Is presented in the Temple, and foretold to be the SAVIOUR of the world.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
7. Flees from the persecution of Herod, and is carried into Egypt.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
8. Herod finds him not, and murders the Innocents.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
9. He is carried back by Joseph and his Mother into Nazareth, his home.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
10. Disputes in the Temple with the doctors, being twelve years old.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
(Add, if said for the departed: Eternal rest give to them, O Lord, and let perpetual light shine upon them. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.)

SECOND DECADE.
JESUS is most obedient to the Blessed Virgin his Mother, and to St Joseph.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
1. When thirty years old, He is baptized by John in the Jordan.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
2. Fasts forty days in the desert, and overcomes the tempter.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
3. Practises and preaches his own holy law, whereby is life eternal.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
4. Calls his disciples, who forthwith leave all and follow Him.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
5. Works his first miracle of changing water into wine.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
6. Heals the sick, makes the lame to walk, gives hearing to the deaf, sight to the blind, life to the dead.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
7. Converts sinful men and women, and pardons their sins.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
8. When the Jews persecute Him even unto death, He chastises them not, but sweetly chides them.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
9. Is transfigured on Mount Thabor, in the presence of Peter, James and John.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
10. Enters triumphant into Jerusalem sitting on an ass''s colt, and drives the profaners from the Temple.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
(Add, if said for the departed: Eternal rest give to them, O Lord, and let perpetual light shine upon them. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.)

THIRD DECADE.
JESUS takes leave of his most holy Mother before He goes to die for our salvation.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
1. Celebrates the last Paschal Supper, washes the Apostles'' feet.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
2. Institutes the most holy Sacrament of the Eucharist.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
3. Prays in the garden, sweats blood, and is comforted by an angel.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
4. Is betrayed by Judas with a kiss, is taken and bound by the officers of justice as a great malefactor.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
5. Is falsely accused, is buffeted and spit upon, and shamefully used before four tribunals.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
6. Looks tenderly on Peter after he had thrice denied Him, and converts him; whilst Judas despairs, hangs himself, and is lost.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
7. Is cruelly scourged at the pillar, and receives innumerable blows.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
8. Is crowned with thorns, shown to the people, who cry, Crucify Him! Crucify Him!

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
9. Is condemned to die, carries the heavy cross with grievous pain upon his shoulders to Mount Calvary.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
10. Is crucified between two thieves, dies after three hours'' most painful agony, is wounded in the side with a lance, and is buried.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
(Add, if said for the departed: Eternal rest give to them, O Lord, and let perpetual light shine upon them. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.)

JESUS rises the third day, and visits first of all Mary his most holy Mother.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
1. Appears to the three Marys, and bids them tell the disciples they have seen Him risen from the dead.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
2. Appears to the disciples, shows them his most holy Wounds, makes Thomas touch them.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.
3. The fortieth day after his resurrection, blesses most holy Mary his Mother and all his disciples; then ascends into heaven.

Our father, Who art in heaven, hallowed be Thy name. Thy kingdom come; Thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation; but deliver us from evil. Amen.

Let us pray to the most holy Virgin to obtain for us also the blessing of her divine Son JESUS CHRIST, now and at the hour of our death.

Hail, Mary, full of grace; the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.
(Add, if said for the departed: Eternal rest give to them, O Lord, and let perpetual light shine upon them. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen.)
Then say the Credo in honour of the holy Apostles.

I believe in God, the Father Almighty, Creator of heaven and earth; and in Jesus Christ, His only Son, our Lord: Who was conceived by the Holy Ghost, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; the third day He rose again from the dead; He ascended into heaven, sitteth at the right hand of God, the Father Almighty; from thence He shall come to judge the living and dead. I believe in the Holy Ghost, the holy Catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and the life everlasting. Amen.' WHERE slug = 'rosary-of-our-lord';
