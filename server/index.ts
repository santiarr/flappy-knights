import { defineServer, defineRoom } from "colyseus";
import { GameRoom } from "./GameRoom";

const port = Number(process.env.PORT) || 2567;

const server = defineServer({
    rooms: {
        game: defineRoom(GameRoom),
    },
});

server.listen(port).then(() => {
    console.log(`Colyseus server listening on port ${port}`);
});
