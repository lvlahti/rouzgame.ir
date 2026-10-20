const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
let clients = [];

console.log("Signaling server started on port 8080");

wss.on('connection', (ws) => {
    if (clients.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full! Only 2 users allowed.' }));
        ws.close();
        return;
    }

    clients.push(ws);
    console.log(`Client connected. Total clients: ${clients.length}`);

    ws.on('message', (message) => {
        // ارسال پیام دریافتی به کاربر دیگر (Peer)
        const target = clients.find(client => client !== ws);
        if (target && target.readyState === ws.OPEN) {
            target.send(message.toString());
        }
    });

    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log(`Client disconnected. Total clients: ${clients.length}`);
    });
});
