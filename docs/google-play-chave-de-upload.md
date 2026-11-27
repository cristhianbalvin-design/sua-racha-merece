# Chave de upload do Google Play

1. Em um computador seguro, gere uma chave de upload: `keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Escolha senhas fortes e guarde o arquivo e as senhas em local seguro, com cópia de recuperação. Não os envie ao repositório.
2. Codifique o arquivo em base64 sem quebras de linha: no Linux, `base64 -w 0 upload.keystore`; no PowerShell, `[Convert]::ToBase64String([IO.File]::ReadAllBytes('upload.keystore'))`.
3. Em Settings › Secrets and variables › Actions do GitHub, crie os secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. Cadastre também `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para a compilação web.
4. No Play Console, configure o Play App Signing e siga as instruções para registrar a chave de upload. A chave de assinatura dos aplicativos é gerenciada pelo Google; preserve a chave de upload para futuras versões.
5. Execute manualmente o workflow Android AAB, baixe o artifact e envie-o ao Play Console. Confirme pacote, versão, assinatura e requisitos da loja antes de publicar.
