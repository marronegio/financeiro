# DinPrev Mobile (Android e iOS)

O site/webapp continua igual. Os apps são o mesmo build do Vite empacotado com
[Capacitor](https://capacitorjs.com): as pastas `android/` e `ios/` são os
projetos nativos e devem ser commitadas (os artefatos de build já estão nos
`.gitignore` delas).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run mobile:sync` | Builda o web e sincroniza para `android/` e `ios/` |
| `npm run mobile:android` | Builda, sincroniza e abre no Android Studio |
| `npm run mobile:ios` | Builda, sincroniza e abre no Xcode (só em Mac) |

Antes de buildar para mobile, defina no `.env`:

```
VITE_SITE_URL=https://SEU-DOMINIO   # destino dos links de e-mail enviados de dentro do app
```

Esse domínio precisa estar na allowlist de redirect do Supabase
(Authentication → URL Configuration).

## Android (neste PC)

1. Instale o [Android Studio](https://developer.android.com/studio).
2. `npm run mobile:android` — o projeto abre no Android Studio.
3. Rode no emulador/celular (▶) ou gere o `.aab` para a Play Store em
   Build → Generate Signed App Bundle.

## iOS (na nuvem, sem Mac)

O build roda no [Codemagic](https://codemagic.io) — plano gratuito com
500 min/mês de macOS. Configuração em [codemagic.yaml](codemagic.yaml):

1. Entre no codemagic.io com o GitHub e adicione o repo `marronegio/financeiro`.
2. Crie o grupo de variáveis `dinprev` (Teams → Environment variables) com
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL`.
3. Workflow **ios-verificacao**: compila o app sem assinatura a cada push na
   `main` — serve para garantir que o iOS builda. Não precisa de conta Apple.
4. Workflow **ios-testflight**: gera o IPA assinado e envia ao TestFlight.
   Requer conta Apple Developer (US$ 99/ano), a chave da API do App Store
   Connect cadastrada no Codemagic com o nome `dinprev-asc` e o app criado no
   App Store Connect com bundle id `com.dinprev.app`.

## Ícones e splash screen

As artes-fonte ficam em `assets/` (geradas a partir de `public/logo.png`).
Para regenerar depois de trocar o logo:

```
npx capacitor-assets generate --ios --android
```

## Avisos de loja

- O checkout (ASAAS/Stripe) abre no navegador externo. Apple e Google podem
  exigir compra in-app para assinaturas digitais na revisão do app — planeje
  adicionar IAP ou justificar a exceção.
- Contas: Google Play Console (US$ 25 única vez) e Apple Developer (US$ 99/ano).
