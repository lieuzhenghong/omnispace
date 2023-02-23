/**
 * Camera by @robashton returns Camera object.
 *  constructor initial parameters:
 *  @param {context} str *required 
 *  @param {settings} str *optional
  */

class Camera {
    constructor(context, settings = {}) {
        this.distance = settings.distance || 1000.0;
        this.lookAt = settings.initialPosition || [0, 0];
        this.context = context;
        this.fieldOfView = settings.fieldOfView || Math.PI / 4.0;
        this.viewport = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            scale: [settings.scaleX || 1.0, settings.scaleY || 1.0]
        };
        this.init();
    }

    /**
     * Camera Initialization
     * -Add listeners.
     * -Initial calculations.
     */
    init() {
        // this.addListeners();
        this.updateViewport();
    }

    /**
     * Applies to canvas context the parameters:
     *  -Scale
     *  -Translation
     */
    begin() {
        this.context.save();
        this.applyScale();
        this.applyTranslation();
    }

    /**
     * 2d Context restore() method
     */
    end() {
        this.context.restore();
    }

    /**
     * 2d Context scale(Camera.viewport.scale[0], Camera.viewport.scale[0]) method
     */
    applyScale() {
        this.context.scale(this.viewport.scale[0], this.viewport.scale[1]);
    }

    /**
     * 2d Context translate(-Camera.viewport.left, -Camera.viewport.top) method
     */
    applyTranslation() {
        this.context.translate(-this.viewport.left, -this.viewport.top);
    }

    /**
     * Camera.viewport data update
     */
    updateViewport() {
        this.aspectRatio = this.context.canvas.width / this.context.canvas.height;
        this.viewport.width = this.distance * Math.tan(this.fieldOfView);
        this.viewport.height = this.viewport.width / this.aspectRatio;
        this.viewport.left = this.lookAt[0] - (this.viewport.width / 2.0);
        this.viewport.top = this.lookAt[1] - (this.viewport.height / 2.0);
        this.viewport.right = this.viewport.left + this.viewport.width;
        this.viewport.bottom = this.viewport.top + this.viewport.height;
        this.viewport.scale[0] = this.context.canvas.width / this.viewport.width;
        this.viewport.scale[1] = this.context.canvas.height / this.viewport.height;
    }

    /**
     * Zooms to certain z distance
     * @param {*z distance} z 
     */
    zoomTo(z) {
        this.distance = z;
        this.updateViewport();
    }

    /**
     * Moves the centre of the viewport to new x, y coords (updates Camera.lookAt)
     * @param {x axis coord} x 
     * @param {y axis coord} y 
     */
    moveTo(x, y) {
        this.lookAt[0] = x;
        this.lookAt[1] = y;
        this.updateViewport();
    }

    /**
     * Transform a coordinate pair from screen coordinates (relative to the canvas) into world coordinates (useful for intersection between mouse and entities)
     * Optional: obj can supply an object to be populated with the x/y (for object-reuse in garbage collection efficient code)
     * @param {x axis coord} x 
     * @param {y axis coord} y 
     * @param {obj can supply an object to be populated with the x/y} obj 
     * @returns 
     */
    screenToWorld(x, y, obj) {
        obj = obj || {};
        obj.x = (x / this.viewport.scale[0]) + this.viewport.left;
        obj.y = (y / this.viewport.scale[1]) + this.viewport.top;
        return obj;
    }

    /**
     * Transform a coordinate pair from world coordinates into screen coordinates (relative to the canvas) - useful for placing DOM elements over the scene.
     * Optional: obj can supply an object to be populated with the x/y (for object-reuse in garbage collection efficient code).
     * @param {x axis coord} x 
     * @param {y axis coord} y  
     * @param {obj can supply an object to be populated with the x/y} obj 
     * @returns 
     */
    worldToScreen(x, y, obj) {
        obj = obj || {};
        obj.x = (x - this.viewport.left) * (this.viewport.scale[0]);
        obj.y = (y - this.viewport.top) * (this.viewport.scale[1]);
        return obj;
    }

    /**
     * Event Listeners for:
     *  -Zoom and scroll around world
     *  -Center camera on "R" key
     */
    addListeners() {
        window.onwheel = e => {
            if (e.ctrlKey) {
                // Your zoom/scale factor
                let zoomLevel = this.distance - (e.deltaY * 20);
                if (zoomLevel <= 1) {
                    zoomLevel = 1;
                }

                this.zoomTo(zoomLevel);
            } else {
                // Your track-pad X and Y positions
                const x = this.lookAt[0] + (e.deltaX * 2);
                const y = this.lookAt[1] + (e.deltaY * 2);

                this.moveTo(x, y);
            }
        };

        window.addEventListener('keydown', e => {
            if (e.key === 'r') {
                this.zoomTo(1000);
                this.moveTo(0, 0);
            }
        });
    }
};

let camera = null;

//
// Asset loader
//

var Loader = {
    images: {}
};

Loader.loadImage = function (key, src) {
    var img = new Image();

    var d = new Promise(function (resolve, reject) {
        img.onload = function () {
            this.images[key] = img;
            resolve(img);
        }.bind(this);

        img.onerror = function () {
            reject('Could not load image: ' + src);
        };
    }.bind(this));

    img.src = src;
    return d;
};

Loader.getImage = function (key) {
    return (key in this.images) ? this.images[key] : null;
};

let CanvasTxt = null;

/*
* Spritesheet mapping object
* Maps each matrix ID to their corresponding character spritesheet
*/

let PlayerSpriteSheetMap = {
    "default": "char_default",
    "@fp:melchior.info": "char_fp"
}

/*
* SpriteSheetFrameMap
* Splits up a spritesheet into its individual frames
*/

let SpriteSheetFrameMap = {
    "char_default": {
        "standing": [[0, 40], [41, 81]],
        "walking": [[82, 122], [123, 163], [164, 204], [205, 245]],
    },
    "char_fp": {
        "standing": [[0, 55], [56, 116]],
        "walking": [[118, 172], [173, 235], [236, 296], [297, 354]],
    }
}

/*
* Game object
*
*/ 

let Game = {
    ctx: null,
    lastRender: null,
    lastTick: null,
    worldState: null,
    renderState: null,

    // TODO find a better place to put these variables
    ACTIVE_PLAYER: 1,
    PLAYER_SPEED: 0.1,
    PLAYER_TARGET_DEST: null,

    load: () => {},
    setInitialState: () => {},
    run: () => {},
    main: (tFrame) => {},
    update: () => {},
    render: (tFrame) => {},
};

Game.load = function () {
    return [
        Loader.loadImage('room', './img/room.png'),
        Loader.loadImage('char_default', './img/char_default.png'),
        Loader.loadImage('char_fp', './img/char_fp.png')
    ];
};

Game.setInitialState = function () {
    Game.worldState = {
        world_state_data: {
            0: {
                position: [200, 250],
                direction: "right",
                status: "standing",
            },
            1: {
                position: [130, 210],
                direction: "left",
                status: "standing",
            },
        },
        client_chat_user_ids: {
            0: "default",
            1: "@fp:melchior.info",
        }, 
    };

    Game.renderState = {
        0: {
            messageToDisplay: null,
            currentAnimationFrame: 0,
            lastAnimationChangeTime: Game.lastRender,
        },
        1: {
            messageToDisplay: null,
            currentAnimationFrame: 0,
            lastAnimationChangeTime: Game.lastRender,
        }
    }
};

Game.run = function () {
    console.log(this)
    Game.lastRender = performance.now(); // Pretend the first draw was on first update.
    Game.tickLength = 40; // This sets your simulation to run at 25Hz (40ms)
    var p = Game.load();
    Promise.all(p).then((loaded) => {
        Game.setInitialState();
        Game.main(performance.now());
    });
};

Game.main = function (tFrame) {
    window.requestAnimationFrame(Game.main);
    Game.update(tFrame);
    Game.render(tFrame);
    Game.lastRender = tFrame;
    Game.lastTick = tFrame;
}


/* helper function to truncate long strings (used in bubble rendering) */
function truncate(str, n){
    return (str.length > n) ? str.slice(0, n-1) + '...' : str;
};


Game.render = function (tFrame) {
    // Render characters and map
    // console.log(`Rendering at tFrame ${tFrame}. Last render: ${Game.lastRender}`)

    camera.moveTo(Game.worldState.world_state_data[Game.ACTIVE_PLAYER].position[0], Game.worldState.world_state_data[Game.ACTIVE_PLAYER].position[1])
    camera.begin()
    const room = Loader.getImage("room")
    Game.ctx.drawImage(room, 0, 0, 517, 400)

    for (let playerId in Game.renderState) {
        // Render the player, then any chat bubbles

        // First render the player
        let player = Game.renderState[playerId] // currentAnimationFrame, lastAnimationChangeTime
        const spriteSheetName = PlayerSpriteSheetMap[Game.worldState.client_chat_user_ids[playerId]] // this gives e.g. "char_default"
        const playerSpriteSheet = SpriteSheetFrameMap[spriteSheetName] // this gives {walking: [[]], standing: [[]]}
        let playerCurrentStatus = Game.worldState.world_state_data[playerId].status // this gives "walking" or "standing"
        
        switch(playerCurrentStatus) {
            case ("standing"):
                if (tFrame - player.lastAnimationChangeTime > 500) {
                    player.currentAnimationFrame = (player.currentAnimationFrame + 1) % (playerSpriteSheet[playerCurrentStatus].length)
                    player.lastAnimationChangeTime = tFrame;
                }
                break;
            case ("walking"):
                if (tFrame - player.lastAnimationChangeTime > 150) {
                    player.currentAnimationFrame = (player.currentAnimationFrame + 1) % (playerSpriteSheet[playerCurrentStatus].length)
                    player.lastAnimationChangeTime = tFrame;
                }
                break;
        }

        const sx = playerSpriteSheet[playerCurrentStatus][player.currentAnimationFrame][0]; // start x-coord of the slice of the spritesheet to draw
        const sy = 0;
        const sWidth = playerSpriteSheet[playerCurrentStatus][player.currentAnimationFrame][1] - sx; // width of the slice of the spritesheet to draw
        const char = Loader.getImage(spriteSheetName) // which spritesheet to use 
        const sHeight = char.height; // height of the spritesheet
        const [x, y] = [...Game.worldState.world_state_data[playerId].position] // FIXME: note this needs to be fixed because global position =/= position on canvas

        // flip or don't flip
        if (Game.worldState.world_state_data[playerId].direction === "right") {

            // https://stackoverflow.com/a/35973879 flipping sprite
            Game.ctx.save()
            Game.ctx.translate(x + sWidth, y);
            Game.ctx.scale(-1, 1);            
            Game.ctx.drawImage(
                char, 
                sx, 
                sy,
                sWidth, 
                sHeight, 
                0, 
                0,
                sWidth, 
                sHeight
            )
            Game.ctx.restore()
        }
        else {
            Game.ctx.drawImage(
                char, 
                sx, 
                sy,
                sWidth, 
                sHeight, 
                x, 
                y,
                sWidth, 
                sHeight
            )
        }

        // Render chat bubbles
        // TODO use measureText() to get width and do like line breaks/hyphenation
        // There should exist a library to do this

        if (player.messageToDisplay !== null) {
            // Render messages only for five seconds (FIXME: pull this out into a constant somewhere)
            if (tFrame - player.messageToDisplay[1] < 5000) {
                const boxHt = 150
                const padding = 5
                Game.ctx.font = "16px sans-serif";
                Game.ctx.fillStyle = `rgba(220, 220, 220, 0.7)`
                Game.ctx.fillRect(x, y-boxHt-padding, 100, boxHt);
                Game.ctx.strokeStyle =  `rgba(200, 200, 200, 1.0)`;
                Game.ctx.strokeRect(x, y-boxHt-padding, 100, boxHt);
                Game.ctx.fillStyle = "black";
                CanvasTxt.drawText(Game.ctx, truncate(player.messageToDisplay[0], 100), x, y-boxHt-padding, 100, boxHt)
            }
        }

    }

    camera.end()
}

Game.update = function (tFrame) {
    // Update map and character status
    // console.log(`Updating game state.`)
    let delta = tFrame - Game.lastTick;
    // console.log(`Delta: ${delta}`)
    let playerData = Game.worldState.world_state_data[Game.ACTIVE_PLAYER];

    // Update position
    if (Game.PLAYER_TARGET_DEST !==  null && playerData !== null && playerData.position !== null) {
        // console.log(Game.worldState.world_state_data[Game.ACTIVE_PLAYER].position)
        playerData.status = "walking";
        let [dx, dy] = [Game.PLAYER_TARGET_DEST[0] - playerData.position[0], Game.PLAYER_TARGET_DEST[1] - playerData.position[1] ]
        // console.log(dx, dy)
        let l = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
        dx /= l
        dy /= l
        playerData.direction = dx > 0 ? "right" : "left";
        // console.log(`Normalised: ${dx}, ${dy}`)
        playerData.position[0] += delta * Game.PLAYER_SPEED * dx
        playerData.position[1] += delta * Game.PLAYER_SPEED * dy

        // Remove the target point
        if (distanceBetween(playerData.position, Game.PLAYER_TARGET_DEST) < 1) {
            Game.PLAYER_TARGET_DEST = null;
            // Reset player state to standinga
            playerData.status = "standing";
            Game.renderState[Game.ACTIVE_PLAYER].currentAnimationFrame = 0;
        }
    }

    function distanceBetween(a, b) {
        if (!a || !b) return 0;
        return Math.sqrt(Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2));
    }
}

/* 
* Player object
*
*/

let player = {
    currentAnimationState: null,
    currentAnimationFrame: null,
    lastAnimationChangeTime: null,
    spritesheet: "char_default",
    spriteMapping: {
        "standing": [[0, 40], [41, 81]],
        "walking": [[82, 122], [123, 163], [164, 204], [205, 245]]
    }
}

/*
* Touch handler
*
*
*/

const canvas = document.getElementById('canvas');

function touchHandler(e) {
    if (e.touches) {
      const playerX = e.touches[0].pageX - canvas.offsetLeft;
      const playerY = e.touches[0].pageY - canvas.offsetTop;
      console.log(`Touch:  x: ${playerX}, y: ${playerY}`);
      const coords = camera.screenToWorld(playerX, playerY)
      Game.PLAYER_TARGET_DEST = [coords.x, coords.y];
    }
  }

/*
 * NetworkHandler
 */
const SERVER_URL = "ws://localhost:1337";

// enum values from the protocol
const ACKNOWLEDGE_MESSAGE_TYPE = 0;
const PLAYER_STATE_MESSAGE_TYPE = 1;
const WORLD_STATE_MESSAGE_TYPE = 2;
const PLAYER_INSTANCE_MESSAGE_TYPE = 5;
const PLAYER_INSTANCE_ACKNOWLEDGE_MESSAGE_TYPE = 6;
const PLAYER_CHAT_USER_ID_MESSAGE_TYPE = 7;
const PLAYER_CHAT_USER_ID_ACKNOWLEDGE_MESSAGE_TYPE = 8;
const DIRECTION_LEFT = 1;
const DIRECTION_RIGHT = 2;
const STATUS_IDLE = 0;
const STATUS_WALK = 1;

// from godot's binary serialization API
const VECTOR2_TYPE_MAGIC_NUMBER = 5;


class NetworkHandler {
    constructor() {
        // this flag is used to delay sending player state,
        this.is_initialized = false;
        this.encoder = new TextEncoder();
        this.socket = new WebSocket(SERVER_URL)
        this.socket.binaryType = "blob";

        this.socket.addEventListener('open', (event) => {
            console.log("[NetworkHandler] socket opened");
        });
        this.socket.addEventListener('message', (event) => {
            event.data
                .arrayBuffer()
                .then((arrayBuffer) => {
                    const payload =  new DataView(arrayBuffer);
                    const messageType = payload.getUint8(0);
                    console.log(`[NetworkHandler] received event type: ${messageType}`);
                    switch (messageType) {
                        case ACKNOWLEDGE_MESSAGE_TYPE:
                            console.log(`[NetworkHandler::on_message] server acknowledged connection, client_id: ${payload.getUint16(1, true)}`);
                            console.log("[NetworkHandler::on_message] sending player chat user id")
                            this.sendPlayerChatUserId('@fp:melchior.info');
                            break;
                        case PLAYER_CHAT_USER_ID_ACKNOWLEDGE_MESSAGE_TYPE:
                            console.log("[NetworkHandler::on_message] server acknowledged PLAYER_CHAT_USER_ID message");
                            console.log("[NetworkHandler::on_message] registering player to instance")
                            this.sendPlayerInstance(0n);
                            break;
                        case PLAYER_INSTANCE_ACKNOWLEDGE_MESSAGE_TYPE:
                            console.log("[NetworkHandler::on_message] server acknowledged PLAYER_INSTANCE message");
                            console.log("[NetworkHandler::on_message] network handler is initialized");
                            this.is_initialized = true;
                            break;
                        case WORLD_STATE_MESSAGE_TYPE:
                            console.log("[NetworkHandler::on_message] received world state");
                            // TODO: this is going to be the most heaviest deserializing
                            // NOTE:
                            //  - not an attempt to implement full deserialization of all godot binary serialization API
                            //  - since we know how the payload of the world state looks like, client code will just assume
                            //    the correct format and decode the necessary information
                            //
                            // Array binary format:
                            //  - magic_number: 4 bytes
                            //  - length: 4 bytes
                            //  - elements: (length * # of bytes for each binary serialized element) bytes
                            //
                            // NOTE: Serialized elements has their preceeding magic number
                            //
                            // PackedByteArray binary format:
                            //  - magic_number: 4 bytes
                            //  - byte_length: 4 bytes
                            //  - bytes: byte_length bytes
                            //
                            // WORLD_STATE message starts with 1 byte message type followed by the
                            // payload which is an Array (magic number: 28) of two PackedByteArrays (magic number: 29),
                            // world_state_data and instance_char_user_id.
                            // These two PackedByteArrays are also binary serialized data:
                            //  - world_state_data:
                            //    - a binary serialized data of an Array of PlayerState elements, which is 14 bytes long.
                            //  - instance_chat_user_id:
                            //    - a binary serialized data of an Array of 2 + arbitrary length string
                            //
                            // WORLD_STATE data binary format:
                            //  - message_type: 1 byte
                            //  - array_magic_number (28): 4 bytes
                            //  - array_length (2): 4 bytes
                            //  - element #0 (world_state_data: PackedByteArray)
                            //  - element #1 (instance_chat_user_id: PackedByteArray)
                            //
                            // .......... yeah this is fukt up


                            console.log("[NetworkHandler::on_message] PAYLOAD: ", new Uint8Array(arrayBuffer));
                            break;
                        default:
                            console.log("[NetworkHandler::on_message] received unexpected message: ", arrayBuffer);
                    }
                });
        });
        this.socket.addEventListener('close', (event) => {
            console.log("[NetworkHandler] socket closed");
        });
        this.socket.addEventListener('error', (event) => {
            console.log(`[NetworkHandler] error: ${JSON.stringify(event)}`);
        });
    }

    /**
     *  @param {userId} str *required
    */
    sendPlayerChatUserId(userId) {
        this.sendMessage(PLAYER_CHAT_USER_ID_MESSAGE_TYPE, this.encoder.encode(userId));
    }

    /**
     *  @param {instanceId} bigint (U64) *required
    */
    sendPlayerInstance(instanceId) {
        const buffer = new ArrayBuffer(8);
        new DataView(buffer).setBigUint64(0, instanceId, true /* littleEndian */);
        this.sendMessage(PLAYER_INSTANCE_MESSAGE_TYPE, new Uint8Array(buffer));
    }

    /**
     *  @param {playerState} Object *required
     *  playerState schema: {
     *    "position": number[2],
     *    "direction": String of type "right" | "left"
     *    "status": String of type "standing" | "walking"
     *  }
     *
     *  NOTE: godot's Vector2 type uses 12 bytes: 4 bytes for type identifier, 4 bytes for each axis
    */
    sendPlayerState(playerState) {
        if (!this.is_initialized) return;
        const buffer = new ArrayBuffer(14);
        const dataView = new DataView(buffer);

        // pack position
        dataView.setUint32(0, VECTOR2_TYPE_MAGIC_NUMBER, true /* littleEndian */);
        dataView.setFloat32(4, playerState.position[0], true /* littleEndian */);
        dataView.setFloat32(8, playerState.position[1], true /* littleEndian */);

        // pack direction
        const direction = (playerState.direction === "left") ? DIRECTION_LEFT : DIRECTION_RIGHT;
        dataView.setUint8(12, direction, true /* littleEndian */);

        // pack status
        const status = (playerState.status === "standing") ? STATUS_IDLE : STATUS_WALK;
        dataView.setUint8(13, direction, true /* littleEndian */);

        this.sendMessage(PLAYER_STATE_MESSAGE_TYPE, new Uint8Array(buffer));
    }

    /**
     *  @param {messageType} number *required
     *  @param {messageData} Uint8Array *required
    */
    sendMessage(messageType, messageData) {
        const payload = new Uint8Array([messageType, ...messageData]);
        console.log("[NetworkHandler::send] sending: ", payload);
        this.socket.send(payload);
    }
}

const networkHandler = new NetworkHandler();


// 
// Let's start the game!
//

canvas.addEventListener("touchstart", touchHandler);
canvas.addEventListener("touchmove", touchHandler);

window.onload = function () {
    Game.ctx = canvas.getContext('2d');
    camera = new Camera(Game.ctx, {distance: 350});
    CanvasTxt = window.canvasTxt.default;
    Game.run();
};
