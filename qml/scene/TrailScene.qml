import QtQuick
import QtQuick3D
import QtQuick3D.Helpers
import co.goodinput.Kribbage.Mesh
import "../../board/trail.mjs" as Trail
import "../../board/scene.mjs" as Scene
import "../../board/ground.mjs" as Ground

// The trail in 3D: rolling ground with the trail painted on it, trees,
// signs, a little life, and the four pegs. The camera rests on a point of
// the trail and, to reach one out of view, lifts, pans and settles.
// Built to the approved prototype (design/trail-prototype.html).
View3D {
    id: view

    property string place: "forest"
    property string pegStyle: "brass"
    // Holes of each player's front and back peg.
    property var fronts: [0, 0]
    property var backs: [0, 0]
    // Off when the person asks for less motion: no drifting, no flights.
    property bool reducedMotion: false

    // Where the camera rests, in world units, and how far it has lifted.
    property real camX: 0
    property real camY: 0
    property real lift: 0
    readonly property real ahead: 150
    readonly property real pitch: 50
    readonly property real baseR: {
        const hfov = 2 * Math.atan(Math.tan(camera.fieldOfView * Math.PI / 360) * width / Math.max(1, height));
        return Math.max(700, Math.min(2000, 520 / Math.tan(hfov / 2)));
    }
    readonly property var look: Trail.PLACES[place]

    // Milliseconds since the scene started, for everything that moves.
    property real now: 0
    FrameAnimation {
        running: true
        onTriggered: view.now += frameTime * 1000
    }

    camera: camera
    environment: ExtendedSceneEnvironment {
        backgroundMode: SceneEnvironment.Color
        clearColor: view.look.sky
        antialiasingMode: SceneEnvironment.MSAA
        antialiasingQuality: SceneEnvironment.High
        tonemapMode: SceneEnvironment.TonemapModeFilmic
        // Qt lights a little brighter than the prototype did; this brings it level.
        exposure: view.look.exposure * 0.8
        fog: Fog {
            enabled: true
            color: view.look.fog
            depthEnabled: true
            depthNear: view.radius * 0.95
            depthFar: view.radius * 2.6
            depthCurve: 1
        }
    }
    readonly property color hemi: look.hemiSky
    readonly property real radius: baseR * (1 + lift * 1.7)

    PerspectiveCamera {
        id: camera
        fieldOfView: 36
        clipNear: 10
        clipFar: 9000
        readonly property real tz: view.camY + view.ahead
        position: Qt.vector3d(view.camX, Math.sin(view.pitch * Math.PI / 180) * view.radius,
                              tz + Math.cos(view.pitch * Math.PI / 180) * view.radius)
        eulerRotation.x: -view.pitch
    }

    // The sun, low in the south-west, and the sky's light from all round.
    DirectionalLight {
        id: sun
        color: view.look.sun
        brightness: view.look.sunI * 0.85
        ambientColor: Qt.rgba(view.hemi.r * view.look.hemiI * 0.8, view.hemi.g * view.look.hemiI * 0.8, view.hemi.b * view.look.hemiI * 0.8, 1)
        castsShadow: true
        shadowMapQuality: Light.ShadowMapQualityHigh
        shadowFactor: 85
        shadowBias: 6
        pcfFactor: 4
        softShadowQuality: Light.PCF8
        // Pointing from (-500, 1100, 300) towards (0, 0, -150).
        eulerRotation: Qt.vector3d(-62, -48, 0)
    }
    DirectionalLight {
        // The sky's colour from above, faintly, for the hemisphere fill.
        color: view.look.hemiSky
        brightness: view.look.hemiI * 0.3
        eulerRotation.x: -90
    }

    // ---- The ground.
    Model {
        id: groundModel
        receivesShadows: true
        geometry: MeshGeometry { id: groundMesh }
        materials: PrincipledMaterial {
            roughness: 1
            baseColorMap: Texture {
                generateMipmaps: true
                mipFilter: Texture.Linear
                sourceItem: Canvas {
                    id: groundCanvas
                    width: 3250
                    height: 3500
                    renderTarget: Canvas.Image
                    onPaint: Ground.paint(getContext("2d"), view.place, width / Trail.WORLD.w)
                }
            }
        }
    }
    // A wide skirt beyond the board so the horizon never shows an edge.
    Model {
        source: "#Rectangle"
        position: Qt.vector3d(Trail.WORLD.w / 2, -140, Trail.WORLD.h / 2)
        eulerRotation.x: -90
        scale: Qt.vector3d(200, 200, 1)
        materials: PrincipledMaterial { baseColor: view.look.ground; roughness: 1 }
    }
    Model {
        visible: !!view.look.water
        source: "#Rectangle"
        position: Qt.vector3d(Trail.shoreX(1400) + 3000 - 40, -14, Trail.WORLD.h / 2)
        eulerRotation.x: -90
        scale: Qt.vector3d(60, 90, 1)
        receivesShadows: true
        materials: PrincipledMaterial {
            // Paler than its own colour: the prototype's lake took the sky.
            baseColor: "#6b97b2"; roughness: 0.3; metalness: 0
            opacity: 0.94; alphaMode: PrincipledMaterial.Blend
        }
    }

    // ---- Trees, bushes and rocks: one mesh per kind.
    property var stands: []
    Repeater3D {
        model: view.stands.length
        delegate: Model {
            required property int index
            readonly property var modelData: view.stands[index]
            castsShadows: true
            receivesShadows: true
            geometry: MeshGeometry { vertices: modelData.vertices.buffer }
            materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.9 }
        }
    }

    // ---- Trail markers at each quarter, the skunk boards, the finish flag.
    Repeater3D {
        model: Trail.signs()
        delegate: Node {
            id: sign
            required property var modelData
            readonly property color board: modelData.sub ? "#1b1b1b" : view.place === "winter" ? "#7b6248" : "#7a5c3c"
            position: Qt.vector3d(modelData.x, Trail.heightAt(view.place, modelData.x, modelData.y), modelData.y)
            Model {
                source: "#Cube"; y: 26; scale: Qt.vector3d(0.05, 0.52, 0.05); castsShadows: true
                materials: PrincipledMaterial { baseColor: sign.board; roughness: 0.9 }
            }
            Model {
                source: "#Cube"; y: 52; scale: Qt.vector3d(0.52, 0.26, 0.04); castsShadows: true
                materials: PrincipledMaterial { baseColor: sign.board; roughness: 0.9 }
            }
            Model {
                source: "#Rectangle"; y: 52; z: 2.05; scale: Qt.vector3d(0.52, 0.26, 1)
                materials: PrincipledMaterial {
                    roughness: 0.9
                    baseColorMap: Texture {
                        sourceItem: Rectangle {
                            width: 256; height: 128
                            color: sign.board
                            Column {
                                visible: !sign.modelData.sub
                                anchors.fill: parent
                                spacing: 0
                                Repeater {
                                    model: 6
                                    Item { width: 256; height: 20; Rectangle { y: 16; width: 256; height: 4; color: Qt.rgba(0, 0, 0, 0.18) } }
                                }
                            }
                            Rectangle { visible: !!sign.modelData.sub; y: 58; width: 256; height: 10; color: "#F8F8FF" }
                            Text {
                                anchors.horizontalCenter: parent.horizontalCenter
                                y: sign.modelData.sub ? 6 : 26
                                text: sign.modelData.text
                                color: "#F8F8FF"
                                font.pixelSize: sign.modelData.sub ? 46 : 66
                                font.weight: Font.DemiBold
                            }
                            Text {
                                visible: !!sign.modelData.sub
                                anchors.horizontalCenter: parent.horizontalCenter
                                y: 76
                                text: sign.modelData.sub
                                color: "#F8F8FF"
                                font.pixelSize: 33
                                font.weight: Font.DemiBold
                            }
                        }
                    }
                }
            }
        }
    }
    Node {
        id: flag
        readonly property var at: Trail.holeAt(0, 121)
        readonly property var parts: Scene.flagParts()
        Model {
            position: Qt.vector3d(flag.at.x - 14, 45, flag.at.y); castsShadows: true
            geometry: MeshGeometry { vertices: flag.parts.pole.vertices.buffer }
            materials: PrincipledMaterial { vertexColorsEnabled: true; metalness: 0.4; roughness: 0.4 }
        }
        Model {
            position: Qt.vector3d(flag.at.x + 3, 79, flag.at.y); castsShadows: true
            geometry: MeshGeometry { vertices: flag.parts.cloth.vertices.buffer }
            materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.8; cullMode: Material.NoCulling }
        }
    }

    // ---- Life along the trail.
    Ambient {
        place: view.place
        now: view.now
        still: view.reducedMotion
    }

    // ---- Pegs: a front and a back peg for each player.
    property var units: [[frontYou, backYou], [frontThem, backThem]]
    component Peg: PegUnit {
        property int hole: 0
        property real nudge: 0
        property real hopAt: -1e9
        readonly property var at: Trail.holeAt(player, hole)
        readonly property real hop: {
            const t = (view.now - hopAt) / 110;
            return t >= 0 && t < 1 ? Math.sin(Math.PI * t) * 14 : 0;
        }
        style: view.pegStyle
        now: view.now
        still: view.reducedMotion
        position: Qt.vector3d(at.x + nudge, Trail.heightAt(view.place, at.x + nudge, at.y) - 2 + hop, at.y)
    }
    // While a player pegs, their back peg is lit and climbs past the front.
    property var moving: [false, false]
    Peg { id: frontYou; player: 0; lit: true; hole: view.fronts[0] }
    Peg { id: backYou; player: 0; lit: view.moving[0]; hole: view.backs[0]; nudge: view.backs[0] === view.fronts[0] && !view.moving[0] ? -18 : 0 }
    Peg { id: frontThem; player: 1; lit: true; hole: view.fronts[1] }
    Peg { id: backThem; player: 1; lit: view.moving[1]; hole: view.backs[1]; nudge: view.backs[1] === view.fronts[1] && !view.moving[1] ? -18 : 0 }

    // ---- Building a place.
    function build() {
        const g = Scene.ground(place);
        groundMesh.indices = g.indices.buffer;
        groundMesh.vertices = g.vertices.buffer;
        stands = Scene.forest(place);
        groundCanvas.requestPaint();
    }
    onPlaceChanged: build()
    Component.onCompleted: build()

    // ---- The camera.
    // Where a point of the board lands on screen; `up` lifts it off the ground.
    function project(x, y, up) {
        return mapFrom3DScene(Qt.vector3d(x, Trail.heightAt(place, x, y) + (up || 0), y));
    }
    function inView(pt) {
        const p = project(pt.x, pt.y, 30);
        const nx = p.x / width * 2 - 1, ny = 1 - p.y / height * 2;
        return Math.abs(nx) < 0.8 && ny > -0.1 && ny < 0.85;
    }
    function rest(pt) {
        flight.stop();
        camX = pt.x; camY = pt.y; lift = 0;
    }
    // Flies to a point of the board unless it is already in view (or
    // `force`). Calls `done(moved)` when it settles.
    function lookAt(pt, force, done) {
        if (!force && inView(pt)) { if (done) done(false); return; }
        const dist = Math.hypot(pt.x - camX, pt.y - camY);
        if (reducedMotion) { rest(pt); if (done) done(true); return; }
        flight.finish(false);
        flight.fromX = camX; flight.fromY = camY; flight.toX = pt.x; flight.toY = pt.y;
        flight.peak = Math.min(0.55, dist / 2200);
        flight.duration = Math.max(800, Math.min(1900, 600 + dist * 0.9));
        flight.done = done || null;
        flight.t0 = now;
        flight.running = true;
    }
    FrameAnimation {
        id: flight
        property real fromX; property real fromY; property real toX; property real toY
        property real peak; property real duration: 1000; property real t0
        property var done: null
        function finish(moved) {
            running = false;
            const d = done; done = null;
            if (d) d(moved);
        }
        onTriggered: {
            const t = Math.min(1, (view.now - t0) / duration);
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            view.camX = fromX + (toX - fromX) * e;
            view.camY = fromY + (toY - fromY) * e;
            view.lift = peak * Math.sin(Math.PI * t);
            if (t >= 1) { view.lift = 0; finish(true); }
        }
    }

    // ---- Moving pegs. The back peg leapfrogs the front one, hole by hole.
    function setPegs(player, front, back) {
        const f = fronts.slice(), b = backs.slice(), m = moving.slice();
        f[player] = front; b[player] = back; m[player] = false;
        fronts = f; backs = b; moving = m;
    }
    // One hole forward for the climbing peg, with a little hop.
    function stepBack(player, hole) {
        const b = backs.slice(), m = moving.slice();
        b[player] = hole; m[player] = true;
        backs = b; moving = m;
        units[player][1].hopAt = now;
    }
}
