<?php
// Endpoint do formulário "Fale conosco".
// Recebe os dados (JSON) enviados pelo app e manda um e-mail para a caixa de
// contato usando o servidor de e-mail local da hospedagem (TurboCloud).
//
// Fica na raiz do site (o Vite copia /public para /dist), acessível em
// https://SEU-DOMINIO/contato.php — mesma origem do app, então não precisa CORS.

declare(strict_types=1);

// Destino e remetente. O remetente deve ser uma caixa do PRÓPRIO domínio
// (passa no SPF do servidor); o e-mail de quem escreveu vai no Reply-To.
const CONTACT_TO   = 'contato@dinprev.com.br';
const CONTACT_FROM = 'contato@dinprev.com.br';
const FROM_NAME    = 'DinPrev — Fale conosco';

header('Content-Type: application/json; charset=utf-8');

function fail(int $status, string $msg): void {
    http_response_code($status);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Método não permitido.');
}

// Aceita JSON (envio do app) ou form-urlencoded como fallback.
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = $_POST;
}

$nome     = trim((string)($data['nome'] ?? ''));
$email    = trim((string)($data['email'] ?? ''));
$whatsapp = trim((string)($data['whatsapp'] ?? ''));
$mensagem = trim((string)($data['mensagem'] ?? ''));

// Todos os campos são obrigatórios.
if ($nome === '' || $email === '' || $whatsapp === '' || $mensagem === '') {
    fail(400, 'Preencha todos os campos.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail(400, 'E-mail inválido.');
}
// WhatsApp com DDD: ao menos 10 dígitos (2 do DDD + 8 do número).
if (strlen(preg_replace('/\D/', '', $whatsapp)) < 10) {
    fail(400, 'Informe um WhatsApp válido com DDD.');
}

// Proteção contra injeção de cabeçalho: nada de quebras de linha nos campos que
// vão para os headers do e-mail.
$cleanHeader = static fn(string $s): string => trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $s));
$nomeHdr  = $cleanHeader($nome);
$emailHdr = $cleanHeader($email);

// Limites simples (anti-abuso).
if (mb_strlen($nome) > 120 || mb_strlen($mensagem) > 5000) {
    fail(400, 'Conteúdo muito longo.');
}

$assunto = '[Fale conosco] ' . $nomeHdr;

$esc  = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$corpo =
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0a2540;max-width:560px">'
  . '<h2 style="font-size:18px;margin:0 0 16px">Nova mensagem do "Fale conosco"</h2>'
  . '<table style="font-size:15px;line-height:1.5;border-collapse:collapse">'
  . '<tr><td style="padding:4px 12px 4px 0;color:#8898aa">Nome</td><td><b>' . $esc($nome) . '</b></td></tr>'
  . '<tr><td style="padding:4px 12px 4px 0;color:#8898aa">E-mail</td><td>' . $esc($email) . '</td></tr>'
  . '<tr><td style="padding:4px 12px 4px 0;color:#8898aa">WhatsApp</td><td>' . $esc($whatsapp) . '</td></tr>'
  . '</table>'
  . '<p style="margin:16px 0 6px;color:#8898aa;font-size:13px">Mensagem</p>'
  . '<div style="font-size:15px;line-height:1.55;white-space:pre-wrap;border-left:3px solid #e6e9ef;padding-left:12px">'
  . nl2br($esc($mensagem))
  . '</div></div>';

$headers   = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-Type: text/html; charset=UTF-8';
$headers[] = 'From: ' . $cleanHeader(FROM_NAME) . ' <' . CONTACT_FROM . '>';
$headers[] = 'Reply-To: ' . $nomeHdr . ' <' . $emailHdr . '>';

// O 5º parâmetro (-f) define o envelope sender, importante para SPF/entrega.
$ok = mail(CONTACT_TO, $assunto, $corpo, implode("\r\n", $headers), '-f' . CONTACT_FROM);

if (!$ok) {
    fail(502, 'Não foi possível enviar agora. Tente novamente.');
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
