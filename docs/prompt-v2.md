# Planlama prompt'u v2 (onaylı)

Bu proje için kıdemli bir Mobile Architect, Full-Stack Engineer, Database
Architect ve Security Engineer gibi hareket et.

Amacın, aşağıda tanımlanan İngilizce kelime öğrenme uygulamasını geliştirmek
için uygulanabilir, test edilebilir ve aşamalara ayrılmış bir teknik uygulama
planı hazırlamak. Her teknik kararda kısa bir gerekçe ("neden") ver; ilk kez
geçen teknik terimleri bir cümleyle açıkla.

ÖNEMLİ: Şu anda yalnızca PLANLAMA aşamasındayız.

- Proje dizini henüz yok. İsim onayından sonra ~/Desktop/<repo-adı> olarak
  oluşturulacak; dizin adı ile GitHub repo adı aynı olacak. Planı sıfırdan
  kurulacak bir proje varsayımıyla hazırla.
- Masaüstündeki diğer projeleri tarama; onlardan kod veya plan taşıma.
- Kaynak kodu veya yapılandırma dosyalarını değiştirme.
- Dosya oluşturma, silme, taşıma, paket kurma veya migration çalıştırma.
- Git commit veya push yapma.
- GitHub reposu oluşturma veya herkese açık bir yere kod gönderme.
- Fly.io ya da Supabase üzerinde kaynak veya servis oluşturma.
- Gizli anahtarları, parolaları veya erişim bilgilerini isteme.
- Salt okunur kontroller serbest: kurulu CLI sürümleri, GitHub'da isim
  müsaitliği, resmî doküman ve lisans araştırması.
- Planı tamamladığında dur ve uygulamaya geçmek için benden onay bekle.

==================================================
0. MALİYET VE ORTAM KISITLARI
==================================================

- Apple Developer hesabı ödenmiş durumda. Bunun dışında ücretli servis
  kullanılmayacak.
- Fly.io kullandıkça öde modelinde; aylık 5$ altındaki faturalar şu an
  tahsil edilmiyor, ancak bu resmî bir garanti değil. Fly.io üzerindeki
  toplam tahmini maliyet aylık 5$'ın altında kalmalı ve hesaplanarak
  gösterilmeli.
- Supabase ve Fly.io için bu uygulamaya özel yeni hesaplar açılacak.
  Mevcut hesaplar ve CLI oturumları kullanılmayacak; planlama aşamasında
  hiçbir hesaba giriş yapılmayacak. Yeni Fly.io hesabının deneme süresi,
  kart şartı ve 5$ altı muafiyetin yeni hesapta geçerliliği doğrulanmalı.
- Supabase yalnızca Free plan ile kullanılacak. Bilinen sınırlar: 2 aktif
  proje, 500 MB veritabanı, 1 GB dosya depolama, 5 GB aylık egress, 7 gün
  düşük aktivitede proje duraklatma (pause). Güncel değerleri doğrula. Her
  bileşenin hangi sınıra dayandığını ve sınır aşılırsa ne olacağını yaz.
- Kredi kartı gerektiren veya ücretsiz kotası için kart isteyen servis
  önerme (bulut TTS API'leri dahil).
- EAS Free planı (ayda sınırlı iOS build, düşük öncelikli kuyruk) ile Xcode
  üzerinden yerel build'i karşılaştır.
- Android: Google Play Console tek seferlik ücret ister; şimdilik
  ödenmeyecek. Android emülatör ve APK ile test edilebilir durumda tutulacak;
  mağaza yayını ayrı bir karar.
- Makinede kurulu araçlar: Xcode, CocoaPods, Node 24, pnpm, eas-cli, Docker,
  gh, flyctl, supabase CLI. Sürümlerini ve çalışır durumda olduklarını
  salt okunur komutlarla doğrula; giriş komutlarını çalıştırma.

==================================================
1. ÜRÜNÜN AMACI VE HEDEFİ
==================================================

iOS öncelikli, daha sonra Android üzerinde de çalışacak bir İngilizce kelime
öğrenme uygulaması geliştirilecek.

Kullanıcılar hem mobil uygulamadan hem de web arayüzünden hesaplarına giriş
yapabilecek. Kartlarını ve izin verilen kişisel verilerini web üzerinden de
düzenleyebilecek.

Uygulamanın önemli özelliklerinden biri, kart çalışırken mevcut çalışma
ekranından ayrılmadan üç yönde sözlük araması yapabilmektir:

1. İngilizce → Türkçe
2. Türkçe → İngilizce
3. İngilizce → İngilizce

Kartların ve bu üç yönlü sözlüğün çevrimdışı çalışması ürünün temel
gereksinimidir. Diğer özelliklerin çevrimdışı çalışıp çalışmayacağı teknik
inceleme sonrasında kararlaştırılacaktır.

Yayın ve ölçek:
- Önce TestFlight (ben ve davet ettiğim test kullanıcıları). App Store
  yayını sonraki aşama; App Store için gerekenler planda ayrı bir aşama
  olarak yer alsın.
- Ölçek varsayımı: TestFlight'ta en fazla 100 kullanıcı; kullanıcı başına
  en fazla 20.000 kart ve 500.000 tekrar kaydı; kullanıcı başına 1–3 cihaz.
  Ücretsiz plan sınırlarını bu varsayımlarla hesapla.

Hesapsız (misafir) kullanım:
- Uygulama hesap açmadan tam olarak kullanılabilir.
- Kullanıcı sonradan kayıt olduğunda cihazdaki veri hesabına bağlanır ve
  senkronize edilir.

Arayüz varsayımları (onaya açık):
- Arayüz dili Türkçe; metinler i18n altyapısıyla tutulur.
- iPhone öncelikli; iPad'de çalışır ama ayrıca optimize edilmez.
- Karanlık mod, Dynamic Type ve VoiceOver temel düzeyde desteklenir.
- Minimum iOS sürümünü öner.

==================================================
2. FLASHCARD ÖZELLİKLERİ
==================================================

Kullanıcı kendi kelime veya ifade kartlarını oluşturabilmeli,
düzenleyebilmeli ve silebilmeli.

Ön yüz:
- İngilizce kelime veya ifade
- Kelimeyi sesli dinlemek için bir buton

Arka yüz:
- Türkçe karşılık veya karşılıklar
- İngilizce örnek cümle

Kartın veri modeli, bir kelimenin birden fazla anlamı ve aynı kelimenin
farklı kullanımları gibi durumları destekleyecek şekilde tasarlanmalı.

Kart modeli ön yüz / arka yüz tanımına bağlı kalacak; ayrı bir not/kart
katmanı kurulmayacak. Deste adlarını kullanıcı belirler; desteler genelde
İngilizce'den Türkçe'ye (ön yüz İngilizce, arka yüz Türkçe) düzenlenir.

Gereksiz alanlar zorunlu tutulmamalı. Örnek cümlenin Türkçe çevirisi,
kullanıcının kart şablonunu özelleştirmesi ve benzeri ek alanlar için
gereksinimleri ve maliyeti değerlendir; varsayımları açıkça belirt.

Kullanıcı sözlükte bulduğu bir sözcüğü tek butonla doğrudan karta
dönüştürebilmeli. Kartın ön yüzüne sözcük, arka yüzüne sözlükteki Türkçe
karşılık(lar) ve İngilizce örnek cümle otomatik gelir; kullanıcının başka bir
alan doldurması gerekmez. Kart sonradan düzenlenebilir.

Sözlükten oluşturulan kart, kaynak sözlük girişinin ve anlamının kalıcı
kimliğini saklamalı. Aynı kelime ve anlam için ikinci kart eklenirken
kullanıcı uyarılmalı.

Kullanıcı kartlarını desteler altında düzenleyebilmeli. Yeni kart oluşturma,
desteye ekleme, kartı başka desteye taşıma, düzenleme ve silme işlemlerini
planla.

Kartlar cihazda kalıcı olarak saklanmalı ve internet bağlantısı olmadan
görüntülenebilmeli, oluşturulabilmeli ve düzenlenebilmeli.

==================================================
3. TEKRAR SİSTEMİ
==================================================

Akıllı tekrar sistemi tasarlanmalı.

Kullanıcının her kart için verdiği cevap veya değerlendirmeye göre sonraki
tekrar zamanı belirlenmeli.

FSRS ve SM-2 gibi mevcut aralıklı tekrar algoritmalarını karşılaştır. Bakım
kolaylığı, platform uyumluluğu, lisans, test edilebilirlik ve öğrenme
deneyimi açısından gerekçeli bir öneri sun.

Algoritmanın uygulama içinde mi yoksa sunucu tarafında mı çalıştırılması
gerektiğini değerlendir. Çevrimdışı kullanım ve çoklu cihaz
senkronizasyonunu dikkate al.

Tekrar geçmişi, son tekrar zamanı, sonraki tekrar zamanı ve kartın öğrenme
durumunun nasıl saklanacağını tasarla.

Ayrıca karara bağla veya seçenekleriyle sun:
- Kart tek bir ön yüz / arka yüz tanımına sahip. Modül 2'nin (aynı kartı
  ters yönde gösterme) kartın tekrar durumunu nasıl etkileyeceği.
- Modül 3–5'ten hangilerinin zamanlamayı etkileyeceği, hangilerinin yalnızca
  pratik sayılacağı; etkileyenlerin sonucunun algoritmaya hangi
  değerlendirmeyle aktarılacağı.
- Günlük yeni kart ve tekrar sınırları, günün başlangıç saati, saat dilimi
  değişimi ve cihaz saatinin yanlış olması durumu.

==================================================
4. ÖĞRENME MODÜLLERİ
==================================================

Aşağıdaki öğrenme yöntemleri ürün kapsamına dahildir:

1. İngilizce kelimeyi görüp anlamını hatırlama.
2. Türkçe karşılığı görüp İngilizce kelimeyi hatırlama.
3. Cevabı yazarak kelime çalışma.
4. Kelimeyi sesli dinleyip yazma.
5. İngilizce ve Türkçe kelimeleri eşleştirme.

Modül 5 için minimum kart sayısını ve eşleştirilecek kelimelerin seçim
yöntemini belirt.

Ses özelliğinde kullanıcı için kelimeyi sesli dinlemek yeterlidir. IPA
gösterimi, fonetik transkripsiyon arayüzü veya ayrıntılı bir telaffuz
eğitimi modülü gerekmiyor.

Ses üretimi veya ses verisi için kullanılabilecek seçenekleri karşılaştır.
Cihazın metin okuma motorunu, gerektiğinde kullanılabilecek ses dosyalarını,
çevrimdışı erişilebilirliği, lisansları ve seslerin kalitesini değerlendir.
Aksan seçimini (en-US / en-GB) ve cihazda İngilizce ses yüklü değilse
(özellikle Android'de çevrimdışı ses paketi) davranışı planla.

Bu modüllerin her biri için internet olmadan çalışmanın teknik olarak mümkün
olup olmadığını ayrı ayrı incele.

==================================================
4A. TÜRKÇE VE İNGİLİZCE METİN İŞLEME
==================================================

Sözlük araması, yazma modu ve dinleyip yazma modu için:

- Türkçe büyük/küçük harf: I/ı ve İ/i dönüşümü doğru yapılmalı (SQLite'ın
  lower() fonksiyonu Türkçeyi bilmez).
- Aksansız arama: "sogan" → "soğan", "cicek" → "çiçek".
- Çekimli kelime araması: "went" → "go", "running" → "run",
  "kitaplarım" → "kitap". Hangi düzeyin çevrimdışı mümkün olduğunu ve
  gereken veri kaynağını belirt.
- Deyim ve phrasal verb araması ("give up", "look forward to").
- Yazma modunda cevap kontrolü: büyük/küçük harf, noktalama, baştaki ve
  sondaki boşluk, harf hatası toleransı, birden fazla doğru cevap ve
  "neredeyse doğru" durumunun kullanıcıya gösterimi.

Her biri için ölçülebilir kabul kriteri yaz.

==================================================
5. SÖZLÜK
==================================================

Sözlük mobil uygulamada ayrı bir sayfaya geçmeyi gerektirmemeli. Mevcut
çalışma ekranının üzerinde açılan bir panel veya uygun bir mobil arayüz
yaklaşımı değerlendirilmeli.

Kullanıcı sözlükte arama yaparken mevcut kartı ve çalışma ilerlemesini
kaybetmemeli.

Sözlükte aşağıdakiler bulunmalı:

- İngilizce → Türkçe arama
- Türkçe → İngilizce arama
- İngilizce → İngilizce tanım arama
- Örnek cümleler
- Uygun veri bulunduğunda sözcük türü, eş anlamlı, zıt anlamlı ve birlikte
  kullanılan kelime kalıpları
- Son aramalar
- Sözlükte bulunan kelimeyi tek butonla flashcard olarak kaydetme
  (bölüm 2)

Tek butonluk akışı bozmadan hedef destenin nasıl belirleneceğini öner
(örneğin son kullanılan deste varsayılan, istenirse değiştirilebilir).
Kelimenin birden fazla anlamı varsa butonun anlam düzeyinde mi, kelime
düzeyinde mi olacağını öner.

ÇEVRİMDIŞI SÖZLÜK ARAŞTIRMASI:

İngilizce-Türkçe, Türkçe-İngilizce ve İngilizce-İngilizce sözlük içeriğinin
çevrimdışı kullanılmasını sağlayacak veri kaynaklarını araştır.

Yalnızca son aramaları önbelleğe almayı yeterli bir çözüm olarak sunma.
Kullanıcı daha önce aramadığı bir kelimeyi de çevrimdışı aramak istiyor.

Her aday kaynak için mümkün olduğunda şunları belirle:

- Türkçe ve İngilizce kelime kapsamı
- İngilizce tanımların kapsamı ve niteliği
- İndirme ve kullanım şekli
- Veri boyutu ve cihazda kullanılacak depolama
- Arama ve indeksleme yaklaşımı
- Lisans ve atıf yükümlülükleri
- Yeniden dağıtım veya ticari kullanım kısıtlamaları
- GPL veya share-alike lisansların App Store dağıtımıyla uyumu
- Güncelleme yöntemi ve bakım maliyeti
- Mobil uygulamaya dahil edilmesi için teknik uygunluk

Güncel ve doğrulanabilir kaynaklar kullan. Resmî dokümantasyon ve lisans
metinlerine öncelik ver. Doğrulayamadığın bir lisans, API veya kapasite
bilgisini kesin gerçek olarak sunma. Lisansı belirsiz kaynakları (örneğin
ticari sözlük sitelerinden veri kazıma) önerme.

En az bir gerçekçi veri kaynağı için uygulanabilirlik değerlendirmesi yap.
Üç yönlü arama gereksinimini karşılamıyorsa bunu açıkça belirt.

Sözlük verisinin uygulamayla birlikte dağıtılması ile kullanıcının isteğine
göre indirilebilen veri paketlerini karşılaştır. iOS'un 200 MB üzeri
indirmelerde hücresel ağda uyarı gösterdiğini dikkate al. İlk kurulumda
hangi kelimelerin çevrimdışı kullanılabilir olması gerektiği konusunda öneri
sun.

Ayrıca planla:
- Veri paketlerinin ücretsiz barındırılması: Supabase Storage egress
  (5 GB/ay) yetmeyebilir; GitHub Releases ve diğer ücretsiz seçenekleri
  sınırlarıyla karşılaştır.
- Sözlük güncellendiğinde kartlardaki referansların bozulmaması (kalıcı
  giriş/anlam kimliği, sürümlü veri paketi).
- Web'de sözlük olacaksa verinin nerede duracağı (500 MB veritabanı sınırı).
- Uygulama içinde "Lisanslar ve atıflar" ekranı.

Henüz karar verilmemiş olan sözlük sağlayıcısını veya veri lisansını
kesinleşmiş kabul etme.

==================================================
6. KİŞİSELLEŞTİRME VE İLERLEME
==================================================

Aşağıdaki özellikler ürün kapsamına dahildir:

- Son aramalar: kullanıcı son aradığı sözcükleri unutmadan görebilir ve
  buradan doğrudan destelerinden birine kart olarak ekleyebilir.
- Zayıf kelimeler listesi: kullanıcının "bunu mutlaka tekrar çalışmalıyım"
  diye işaretlediği kelimeler.
- Öğrenme ve tekrar istatistikleri
- Uygulama ayarları
- Kullanıcının yönetebileceği çalışma hatırlatmaları ve bildirim ayarı

Zayıf kelimeler listesine yalnızca kullanıcının işaretlediği kelimeler
girer. Uygulama, sürekli yanlış cevaplanan kelimeleri listeye eklemesi için
kullanıcıya önerir; tek bir yanlış cevap öneri sebebi değildir. Öneri
eşiğini tekrar geçmişine göre tanımla. İşaretlemenin hangi ekranlardan
yapılacağını (çalışma, kart, sözlük) ve zayıf kelimelerle ayrı çalışma
oturumu açılıp açılmayacağını öner.

İstatistikler yalnızca toplam kart sayısından oluşmamalı. Tekrar geçmişinden
hangi ölçümlerin üretilebileceğini değerlendir.

Hatırlatmalar için yerel cihaz bildirimlerini ve gerekirse sunucu taraflı
push bildirimlerini karşılaştır. İlk sürüm için gereksiz bir bildirim
altyapısı kurma.

Kullanıcı bildirimleri uygulamanın ayarlar ekranından açıp kapatabilmeli ve
uygulanabilir tercihlerini değiştirebilmeli.

Son aramalar, zayıf kelime işaretleri ve ayarlardan hangilerinin cihazlar arasında
senkronize edileceğini, hangilerinin cihaza özel kalacağını gerekçesiyle
öner. Bildirim ayarları cihaza özeldir.

==================================================
7. WEB UYGULAMASI VE KULLANICI HESABI
==================================================

Kullanıcılar aynı hesapla mobil uygulamadan ve web uygulamasından giriş
yapabilmeli.

Web üzerinden en azından:
- Giriş yapma
- Kartları görüntüleme ve düzenleme
- Kart destelerini yönetme
- Kartlarda ve desteklenen kişisel öğrenme verilerinde değişiklik yapma

mümkün olmalı. Web'de çalışma modülleri, sözlük ve istatistiklerin olup
olmayacağını maliyetiyle değerlendir; önerini ayrı belirt. Web çevrimiçi
çalışır; web için çevrimdışı gereksinim yok.

Kimlik doğrulama:
- E-posta adresi ve parola ile kayıt
- E-posta doğrulaması
- Giriş ve çıkış
- Parola sıfırlama
- Misafir kullanımdan kalıcı hesaba geçiş (Supabase anonymous sign-in
  dahil seçenekleri değerlendir)
- Gerekli doğrulama ve hata durumları

içermeli. İlk sürümde sosyal giriş yok. Google gibi bir sosyal giriş
eklenirse Sign in with Apple da gerekir (App Store Guideline 4.8); bunu
kapsam kararlarında not et.

Supabase Auth bu ihtiyaç için kullanılacak. Supabase'in e-posta doğrulaması,
üretim için SMTP gereksinimleri ve ilgili ayarlarını incele.

E-posta gönderimi:
- Supabase'in varsayılan SMTP'si saatte çok az e-posta gönderir ve yalnızca
  organizasyon üyelerine teslim eder; kullanılmayacak.
- TestFlight aşaması: bu uygulamaya özel açılacak bir Gmail hesabı ve app
  password ile Supabase custom SMTP. Gmail'in gönderim sınırlarını, kullanım
  koşullarını ve risklerini doğrula.
- App Store aşaması: alan adı ve işlem e-postası sağlayıcısı ayrı bir karar.
- Doğrulama ve parola sıfırlama linkleri uygulamayı açmalı (deep link /
  universal link). apple-app-site-association dosyasının Fly.io'daki web
  adresinde barındırılabilirliğini doğrula; alternatif olarak 6 haneli kod
  (OTP) ile doğrulamayı değerlendir.
- Kayıt kötüye kullanımına karşı Supabase'in desteklediği ücretsiz CAPTCHA
  seçeneklerini ve Auth rate limit ayarlarını planla.

Çıkış yapıldığında cihazdaki yerel verinin ne olacağını ve aynı cihazda
farklı bir hesapla giriş yapılmasını planla.

Kullanıcıya ait verilerin başka kullanıcılar tarafından görülmesini ve
değiştirilmesini engelle.

Supabase PostgreSQL tabloları için Row Level Security (RLS) politikalarını ve
güvenli erişim modelini planla. Her tablonun hangi kullanıcı tarafından hangi
işlemlerle erişilebilir olduğunu belirt.

Mobil uygulamada veya web tarayıcısında hiçbir gizli servis anahtarı, sunucu
parolası veya yönetici yetkisi gerektiren sır bulunmamalı. Supabase
publishable (anon) anahtarı istemcide bulunabilir; service_role / secret
anahtar asla istemcide, repoda veya build çıktısında olmamalı.

==================================================
8. ÇEVRİMDIŞI VERİ VE SENKRONİZASYON
==================================================

Mobil tarafta yerel kalıcı veritabanı için Expo SQLite gibi uygun
seçenekleri değerlendir. Sözlük araması için FTS5 desteğini doğrula.

Hazır senkronizasyon çözümlerini (örneğin PowerSync, ElectricSQL,
WatermelonDB sync) kendi yazacağımız senkronizasyonla; ücretsiz plan
sınırları, servise bağımlılık riski, karmaşıklık ve test edilebilirlik
açısından karşılaştır.

Temel hedef:
- Kartlar çevrimdışı okunabilmeli ve düzenlenebilmeli.
- Tekrar verisi çevrimdışı güncellenebilmeli.
- Üç yönlü sözlük çevrimdışı kullanılabilmeli.
- İnternet bağlantısı geldiğinde uygun kullanıcı verileri Supabase ile
  eşitlenebilmeli.
- Web ve mobilde yapılan değişiklikler birbirine aktarılabilmeli.

Senkronizasyon tasarımında aşağıdakileri ele al:

- Yerel değişiklik kuyruğu
- Başarısız isteklerin yeniden denenmesi
- Aynı değişikliğin tekrar gönderilmesi durumunda güvenli davranış
- Silinen kayıtların senkronizasyonu
- Aynı kartın web ve mobilde eş zamanlı düzenlenmesi
- Tekrar geçmişi çakışmaları
- Veri kaybı riskleri
- İlk senkronizasyon ve büyük veri kümeleri
- Misafir verisinin hesaba bağlanması
- Migration ve şema sürümü uyumu; sahadaki eski uygulama sürümleri ve
  minimum sürüm zorlaması
- Supabase projesi duraklatıldığında uygulamanın davranışı

Çakışma çözümlemesini yalnızca tüm alanlar için otomatik "son yazan kazanır"
şeklinde varsayma. Kart içeriği, tekrar geçmişi ve kullanıcının farklı
cihazlarda yaptığı düzenlemeler için alternatifleri incele ve gerekçeli bir
yöntem öner.

Sözlük verisini kullanıcıya ait kart verisinden ayrı değerlendir.

ÖZELLİK BAZINDA ÇEVRİMDIŞI MATRİSİ:

Her öğrenme ve uygulama özelliği için şu durumlardan birini işaretle:

- Tam çevrimdışı
- Kısmen çevrimdışı
- Çevrimiçi gerekli

Çevrimdışı çalışması açık gereksinim olan kart ve üç yönlü sözlük dışındaki
modüllerde benim yerime kesin karar verme. Seçenekleri, maliyeti ve kullanıcı
deneyimini göster; önerini ayrı olarak belirt.

==================================================
9. TEKNOLOJİ VE MİMARİ
==================================================

Başlangıç tercihleri:

- Mobil: React Native + Expo + TypeScript. Gerekçesiyle alternatif
  önerebilirsin (örneğin Flutter, Swift/Kotlin native, Kotlin
  Multiplatform); çevrimdışı sözlük, SQLite/FTS, TTS, web ile kod paylaşımı,
  bakım maliyeti ve Android'e geçiş açısından karşılaştır.
- Web: statik build (SSR yok). Next.js static export ile Expo Router web
  çıktısını (mobille ortak kod tabanı) karşılaştır ve birini öner.
- Veritabanı: Supabase tarafından yönetilen PostgreSQL
- Kimlik doğrulama: Supabase Auth
- Sunucu tarafı mantık: gizli anahtar gerektiren işler (hesap silme, veri
  dışa aktarma gibi) için Supabase Edge Functions. Ayrı bir backend API
  servisi, yalnızca Supabase ile karşılanamayan somut bir ihtiyaç
  kanıtlanırsa.
- Mobil yerel veri: Expo SQLite veya doğrulanmış uygun alternatif
- Web dağıtımı: Fly.io üzerinde web'in statik dosyalarını sunan tek küçük
  Docker container
- Kaynak kontrolü ve otomatik kalite kontrolleri: GitHub + GitHub Actions

Bu teknolojileri başlangıç tercihi olarak ele al. Bunları körü körüne kabul
etmek yerine gerekçelerini, alternatiflerini ve risklerini incele. Ancak
yalnızca teknoloji çeşitliliği yaratmak için teknoloji değişikliği
önermemelisin.

TEK REPO / MONOREPO:

Mobil ve web kodlarının tek GitHub reposunda tutulmasını başlangıç seçeneği
olarak değerlendir.

Örnek yapı:

apps/mobile
apps/web
packages/core
supabase/migrations
supabase/seeds
supabase/tests
supabase/functions
docs
.github/workflows

Gerekirse daha uygun bir yapı öner. Ortak iş kurallarını paylaşmak ile mobil
ve web projelerini gereksiz şekilde birbirine bağlamak arasındaki dengeyi
değerlendir.

FLY.IO VE DOCKER:

Fly.io üzerinde yalnızca web'in statik dosya sunucusu çalışacak. Supabase
tarafından yönetilen PostgreSQL'i Fly.io üzerinde ikinci bir veritabanı
olarak kurma. Supabase'in karşılayabildiği işlemler için sırf mimariyi
büyütmek amacıyla ek backend servisi oluşturma.

Dockerfile, Fly.io yapılandırması (trafik yokken makinenin kapanması dahil),
environment variables, secret yönetimi, health check, loglama, hata gözlemi
(yalnızca ücretsiz kotalı araçlar) ve dağıtım stratejisini planla. Tahmini
aylık Fly.io maliyetini hesapla. Fly.io muafiyeti sona ererse aynı statik
build'in ücretsiz bir statik barındırmaya taşınma yolunu yaz.

Mobil uygulamanın iOS ve Android dağıtımını sunucu dağıtımından ayrı ele al:
TestFlight akışı (EAS veya yerel Xcode build), sürüm numaralandırma ve
OTA güncelleme (EAS Update ücretsiz kotası) değerlendirmesi.

==================================================
10. GITHUB VE GELİŞTİRME GÜVENLİĞİ
==================================================

Proje GitHub üzerinde public repo olarak geliştirilecek.

Henüz repo adı belirlenmedi. En az beş isim öner. Her biri için:
- Neden uygun olduğu
- GitHub'da müsait olup olmadığı (salt okunur kontrol)
- App Store adı olarak uygunluğu (en fazla 30 karakter, benzer isimli
  uygulama riski)
- Önerilen bundle ID (yayından sonra değiştirilemez)

Birini tercih et. Dizin adı, repo adı ve uygulama adı birlikte seçilecek.

Ben repo adını teyit etmeden:
- Repo oluşturma
- GitHub'a push
- Public paylaşım
- Başka bir yerde kaynak yayınlama

yapılmayacak.

GitHub Actions üzerinde uygun kalite kontrollerini planla:
- Lint
- TypeScript kontrolü
- Unit testler
- Uygun entegrasyon testleri (yerel Supabase ile RLS testleri dahil)
- Güvenlik ve gizli bilgi kontrolleri

Bağımlılık ve lisans kontrollerini değerlendir.

Public repo içerisinde gerçek kullanıcı verisi, kişisel bilgiler,
veritabanı parolası veya gizli anahtar bulunmamalı.

Kod lisansı henüz belirlenmiş değil. Public repo ile açık kaynak lisansı
arasındaki farkı açıkla; kaynak kod lisansını benim onayım olmadan seçme.
Sözlük verisinin lisansının kod lisansını etkileyip etkilemediğini belirt.

Veritabanı değişikliklerinin sürümlenmiş migration dosyalarıyla
yönetilmesini planla. Geliştirme ve üretim ortamlarını ayrı tut. Free planın
2 proje sınırı nedeniyle geliştirmenin yerelde (supabase start, Docker;
e-postalar yerel posta yakalayıcıya düşer) yapılmasını ve bulutta yalnızca
üretim projesinin bulunmasını değerlendir.

Yedekleme ve geri yükleme: Free planda yönetilen yedeğe güvenme. GitHub
Actions ile zamanlanmış pg_dump, şifrelenmiş ve repo dışında saklanacak
şekilde planla (public repoda Actions artifact'ları başkalarınca
indirilebilir). Geri yükleme provasını kabul kriteri yap.

7 günlük duraklatmaya karşı projenin davranışını ve meşru çözümleri
değerlendir.

Hesap silme uygulama içinden yapılabilmeli (App Store Guideline 5.1.1(v));
bu bir gereksinimdir. Kullanıcı verilerini dışa aktarmayı KVKK kapsamında
değerlendir.

==================================================
10A. YASAL VE MAĞAZA GEREKSİNİMLERİ
==================================================

- Gizlilik politikası ve KVKK aydınlatma metni (web'de yayınlanır); AB
  kullanıcıları için GDPR farkları.
- App Store Connect App Privacy beyanı için toplanan verilerin listesi.
- TestFlight harici test (Beta App Review) gereksinimleri; inceleme için
  demo hesap.
- Sözlük verisi atıfları ve lisans yükümlülükleri.

==================================================
10B. KAPSAM DIŞI (İLK SÜRÜM)
==================================================

Anki/CSV içe aktarma, kartlarda görsel, deste paylaşımı ve herkese açık
desteler, sosyal özellikler ve oyunlaştırma, AI ile kart üretme, ödeme ve
abonelik, sunucu taraflı push bildirimleri, IPA ve telaffuz eğitimi,
örnek cümlede boşluk doldurma, karıştırılan kelimeleri karşılaştırma,
sözlük favorileri.

Bunlardan biri gerekli görünürse "sonraki sürüm" olarak ayrı listele;
ilk sürüm planına ekleme.

==================================================
11. TEST VE KABUL KRİTERLERİ
==================================================

Geliştirme TDD ile yapılacak: her iş önce başarısız olan bir testle başlar,
test geçince tamamlanır. Aşamaları buna uygun böl.

Plan şu alanlarda test yaklaşımı içermeli:

- Kart oluşturma, düzenleme, silme ve deste değiştirme
- Üç yönlü sözlük araması
- Türkçe ve İngilizce metin işleme (bölüm 4A)
- Sözlükten ve son aramalardan tek butonla kart ekleme (alanların doğru
  dolması, hedef deste, mükerrer uyarısı)
- Zayıf kelime işaretleme ve öneri eşiği
- Çevrimdışı uygulama ve yeniden başlatma
- Bağlantı kaybı sırasında yapılan değişikliklerin korunması
- İnternet geri geldiğinde senkronizasyon
- Misafir verisinin hesaba bağlanması
- Çakışan düzenlemeler
- Tekrar zamanlamasının doğruluğu
- Zayıf kelime ve istatistik hesaplamaları
- Sesli okumanın iOS ve Android davranışı
- Bildirim ayarları
- E-posta doğrulama ve parola sıfırlama
- Hesap silme ve veri dışa aktarma
- RLS ve kullanıcılar arası veri izolasyonu
- Web üzerinden yapılan değişikliklerin mobilde görünmesi
- Güvenli yapılandırma ve gizli anahtarların korunması
- Yedekten geri yükleme

Mobil uçtan uca (E2E) test aracını (örneğin Maestro, Detox) seç ve iOS
simülatörünün GitHub Actions'ta çalıştırılmasını değerlendir. Gerçek cihaz
gerektiren testleri (TTS, bildirim) ayrıca işaretle.

Başlangıç performans hedefleri (PoC'de ölçülüp revize edilecek):
- Sözlük araması cihazda p95 ≤ 100 ms (iPhone 12 sınıfı cihaz)
- Soğuk açılış ≤ 2 sn
- 5.000 kart ve 50.000 tekrar kaydıyla ilk senkronizasyon ≤ 30 sn
- Çevrimdışı yapılan 100 değişikliğin bağlantı gelince kayıpsız eşitlenmesi

Her önemli özelliğin tamamlanmış sayılması için ölçülebilir kabul kriterleri
yaz. Sadece "test ekle" demekle yetinme.

==================================================
12. BEKLEDİĞİM PLAN ÇIKTISI
==================================================

Planı aşağıdaki sırayla hazırla.

1. Yönetici özeti ve MVP kapsamı
2. Gereksinimler, açık varsayımlar ve kapsam dışı maddeler
3. Mimari diyagram (Mermaid kullanılabilir)
4. Teknoloji seçenekleri ve gerekçeli kararlar
5. Önerilen repo yapısı
6. Temel veri modeli ve ER diyagramı
7. Mobil yerel veri ve Supabase senkronizasyon tasarımı
8. Çevrimdışı özellik matrisi
9. Üç yönlü sözlük veri kaynağı ve lisans fizibilitesi
10. Kimlik doğrulama, RLS ve güvenlik modeli
11. Fly.io, Docker ve dağıtım yaklaşımı; ücretsiz plan tüketim tablosu
12. Test stratejisi ve kabul kriterleri
13. Aşamalı geliştirme planı
14. Teknik, ürün, maliyet ve yasal riskler
15. En az beş isim önerisi, kontrolleri ve tercih edilen isim
16. Benden karar veya onay gerektiren konular

Geliştirme planını küçük ve doğrulanabilir aşamalara böl. Her aşama için
amaç, yapılacak işler, bağımlılıklar, testler ve tamamlanma kriterleri
belirt.

Özellikle çevrimdışı sözlük ve senkronizasyon gibi yüksek riskli konuların
uygulamanın tamamı inşa edilmeden önce doğrulanmasını sağla. Bu riskleri
test edecek küçük ve kapsamı kontrollü bir proof of concept aşamasının
gerekli olup olmadığını değerlendir. PoC; sözlük paket boyutunu, arama
süresini, Türkçe aramayı, çevrimdışı düzenlemeyi, çakışmayı ve misafir
verisinin hesaba bağlanmasını gerçek veriyle ölçmeli. PoC kodu atılabilir
kabul edilir.

Plan onaylandığında repo içinde docs/plan.md olarak, önemli kararlar ise
docs/decisions/ altında ADR (Architecture Decision Record) olarak
tutulacak; planı buna uygun bölümle.

Güncel teknoloji, fiyat, lisans ve API bilgileri için araştırma yapılabiliyorsa
resmî ve güncel kaynakları kullan, bağlantıları kaydet ve doğrulanmış
bulgularla varsayımları birbirinden ayır. Araştırma yapılamayan konular için
doğrulama gereksinimini açıkça yaz.

Uygulamayı gereksiz yere büyütme. İstenen özellikler dışında büyük yeni ürün
modülleri ekleme. Henüz karar verilmemiş tercihleri kesinleşmiş gibi sunma.

Benden ara aşamalarda bilgi istemek yerine makul varsayımlarla analizi
tamamla. Son bölümde benden onay veya karar bekleyen konuları öncelik
sırasıyla listele.

SON KOŞUL:

Bu yanıt yalnızca bir plan olmalı. Hiçbir dosyayı değiştirme, kodlama işine
başlama, repo oluşturma veya dış servislere dağıtım yapma.

Planı sunduktan sonra dur ve onayımı bekle.
