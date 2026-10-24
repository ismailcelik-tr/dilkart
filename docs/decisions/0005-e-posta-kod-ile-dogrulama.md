# 0005 — E-posta doğrulama ve parola sıfırlama 6 haneli kodla

Durum: Kabul (24 Eki 2026)

**Karar:** Supabase Auth OTP kodu (`{{ .Token }}`); link/universal link yok.
TestFlight aşamasında SMTP: uygulamaya özel Gmail + app password.

**Sonuçlar:** Alan adı ve `apple-app-site-association` gerekmez. Gmail sınırı ve
kısıtlama riski var; App Store öncesi alan adı + işlem e-postası sağlayıcısı.
