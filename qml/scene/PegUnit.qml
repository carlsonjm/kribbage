import QtQuick
import QtQuick3D
import co.goodinput.Kribbage.Mesh
import "../../board/scene.mjs" as Scene
import "../../board/meshes.mjs" as Meshes

// One peg on the trail, in the chosen style and the player's colour. The
// front peg is lit; the one left behind goes dark. `phase` keeps the two
// pegs of a pair from moving in step.
Node {
    id: unit

    property int player: 0
    property string style: "brass"
    property bool lit: true
    property real phase: player * 3 + (lit ? 1 : 0)
    property real now: 0
    property bool still: false

    readonly property var tone: Scene.TONES[player]
    readonly property var parts: Scene.pegParts(style, lit)

    scale: Qt.vector3d(1.15, 1.15, 1.15)

    function vec(hex, k) {
        const c = Meshes.linear(hex);
        return Qt.vector3d(c[0] * k, c[1] * k, c[2] * k);
    }
    function glassPulse() {
        return still ? 0.5 : 0.5 + 0.5 * Math.sin(now / 900 + phase);
    }

    readonly property var finishes: ({
        brass: brass, darkwood: darkwood, enamel: enamel, glow: glow, halo: halo,
        stem: stem, spot: spot, glass: glass, stone: stone, core: core
    })

    // No sky to reflect, so brass is mostly a warm, glossy colour.
    PrincipledMaterial { id: brass; baseColor: "#c9a35a"; metalness: 0.3; roughness: 0.32; specularAmount: 1 }
    PrincipledMaterial { id: darkwood; baseColor: "#5a3d25"; roughness: 0.8 }
    PrincipledMaterial {
        id: enamel
        baseColor: unit.lit ? unit.tone.main : unit.tone.dark
        emissiveFactor: unit.lit ? unit.vec(unit.tone.main, unit.style === "toadstool" ? 0.22 : unit.style === "slim" ? 0.18 : 0.12) : Qt.vector3d(0, 0, 0)
        roughness: unit.style === "toadstool" ? 0.4 : unit.style === "slim" ? 0.35 : 0.25
        metalness: unit.style === "slim" ? 0.1 : 0
    }
    PrincipledMaterial {
        id: glow
        baseColor: unit.lit ? unit.tone.main : unit.tone.dark
        emissiveFactor: unit.vec(unit.lit ? unit.tone.main : unit.tone.dark, unit.lit ? 0.9 : 0.25)
        roughness: 0.2
    }
    PrincipledMaterial {
        id: halo
        baseColor: unit.tone.main
        emissiveFactor: unit.vec(unit.tone.main, 0.5)
        opacity: 0.22
        alphaMode: PrincipledMaterial.Blend
        depthDrawMode: Material.NeverDepthDraw
    }
    PrincipledMaterial { id: stem; baseColor: "#ece6da"; roughness: 0.7 }
    PrincipledMaterial { id: spot; baseColor: "#fbfaf6"; roughness: 0.6 }
    PrincipledMaterial {
        id: glass
        baseColor: unit.lit ? unit.tone.main : "#59616b"
        emissiveFactor: unit.lit ? unit.vec(unit.tone.main, 0.32 + 0.16 * unit.glassPulse()) : Qt.vector3d(0, 0, 0)
        roughness: 0.06
        metalness: 0.1
        opacity: unit.lit ? 0.82 : 0.9
        alphaMode: PrincipledMaterial.Blend
    }
    PrincipledMaterial { id: stone; baseColor: "#5f5d57"; roughness: 0.95 }
    PrincipledMaterial { id: core; baseColor: unit.tone.light; emissiveFactor: unit.vec(unit.tone.light, 1.4) }

    // Parts that move on their own: the firefly's orb drifts and breathes,
    // the crystal's main point turns slowly.
    Node {
        id: orb
        position: unit.still ? Qt.vector3d(0, 34, 0)
            : Qt.vector3d(Math.sin(unit.now / 900 + unit.phase) * 1.2, 34 + Math.sin(unit.now / 520 + unit.phase) * 2.4, 0)
        Repeater3D {
            model: unit.orbParts.length
            delegate: Part {
                list: unit.orbParts
                scale: modelData.finish === "halo" && !unit.still
                    ? Qt.vector3d(1, 1, 1).times(1 + 0.1 * Math.sin(unit.now / 260 + unit.phase)) : Qt.vector3d(1, 1, 1)
            }
        }
    }
    Node {
        id: mainPoint
        y: 4
        eulerRotation.y: (0.3 + (unit.still ? 0 : unit.now / 2600)) * 180 / Math.PI
        Repeater3D { model: unit.mainParts.length; delegate: Part { list: unit.mainParts } }
    }

    // Repeaters count parts by index: handing them the parts themselves
    // would copy each vertex array into a Qt list.
    component Part: Model {
        required property int index
        property var list: []
        readonly property var modelData: list[index]
        castsShadows: modelData.finish !== "halo" && modelData.finish !== "core"
        geometry: MeshGeometry { vertices: modelData.vertices.buffer }
        materials: [unit.finishes[modelData.finish]]
    }
    function partsOn(node) {
        return parts.filter(function (p) { return p.node === node; });
    }
    readonly property var loose: partsOn("")
    readonly property var orbParts: partsOn("orb")
    readonly property var mainParts: partsOn("main")
    Repeater3D { model: unit.loose.length; delegate: Part { list: unit.loose } }

    // A little light of its own, so the lit peg reads from across the trail.
    PointLight {
        visible: unit.lit
        position: unit.style === "firefly" ? orb.position : Qt.vector3d(0, unit.style === "crystal" ? 22 : unit.style === "toadstool" ? 18 : 34, 0)
        color: unit.tone.light
        brightness: unit.style === "firefly" ? 1.6 : unit.style === "crystal" ? 1.0 + 0.4 * unit.glassPulse() : 0.6
        constantFade: 1
        linearFade: 0
        quadraticFade: unit.style === "firefly" ? 0.4 : 0.8
        castsShadow: false
    }
}
