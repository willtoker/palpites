# Palpite VIP Online Real

Web app com backend próprio para usar no celular e no PC.

## O que vem pronto
- landing page com botão de compra por WhatsApp e Telegram
- login com e-mail e senha
- ativação por código VIP
- painel ADM escondido da tela inicial
- geração de 5 palpites
- jogos em grade para aparecerem melhor na tela
- palpites salvos no backend
- consulta de últimos concursos e da semana

## Login ADM padrão
- E-mail: admin@palpitevip.com
- Senha: admin123

## Como rodar
1. Instale Node.js 18+
2. Abra a pasta no terminal
3. Rode:
   npm start
4. Abra:
   http://localhost:3000

## Como subir online
Pode subir em Render, Railway, VPS ou outro host Node.
- Start command: npm start
- Node: 18+

## Onde trocar seus links
Entre como ADM e edite:
- nome da marca
- subtítulo
- link do WhatsApp
- link do Telegram

## Observação
Os dados ficam em data/db.json. Em hospedagem online, o usuário consegue entrar em qualquer aparelho porque os dados ficam no backend.
