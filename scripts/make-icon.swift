import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let S = 1024
// "mark": stesso disegno su fondo trasparente, per la schermata d'avvio e il blocco
let mark = CommandLine.arguments.count > 2 && CommandLine.arguments[2] == "mark"
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: (mark ? CGImageAlphaInfo.premultipliedLast : CGImageAlphaInfo.noneSkipLast).rawValue)!
// coordinate con origine in alto a sinistra
ctx.translateBy(x: 0, y: CGFloat(S)); ctx.scaleBy(x: 1, y: -1)
// nel "mark" il disegno è centrato e rimpicciolito: l'alone sfuma prima del bordo
if mark { ctx.translateBy(x: 512, y: 512); ctx.scaleBy(x: 0.9, y: 0.9); ctx.translateBy(x: -512, y: -475) }
func c(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
  CGColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}
// sfondo nero AMOLED
if !mark { ctx.setFillColor(c(0x000000)); ctx.fill(CGRect(x: 0, y: 0, width: S, height: S)) }

// alone arancio dietro al lampo
let glow = CGGradient(colorsSpace: cs, colors: [c(0xF7931A, 0.35), c(0xF7931A, 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 530, y: 260), startRadius: 0, endCenter: CGPoint(x: 530, y: 260), endRadius: mark ? 250 : 330, options: [])

// lampo (la punta finisce dentro il telecomando: sembra uscire da sopra)
let bolt = CGMutablePath()
bolt.addLines(between: [CGPoint(x: 612, y: 60), CGPoint(x: 410, y: 318), CGPoint(x: 512, y: 318),
                        CGPoint(x: 452, y: 500), CGPoint(x: 660, y: 228), CGPoint(x: 556, y: 228)])
bolt.closeSubpath()
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 40, color: c(0xFFB347, 0.8))
ctx.addPath(bolt); ctx.setFillColor(c(0xF7931A)); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(bolt); ctx.clip()
let boltGrad = CGGradient(colorsSpace: cs, colors: [c(0xFFC46B), c(0xF7931A), c(0xE0700A)] as CFArray, locations: [0, 0.55, 1])!
ctx.drawLinearGradient(boltGrad, start: CGPoint(x: 612, y: 60), end: CGPoint(x: 452, y: 500), options: [])
ctx.restoreGState()

// corpo del telecomando
let body = CGPath(roundedRect: CGRect(x: 372, y: 440, width: 280, height: 500), cornerWidth: 84, cornerHeight: 84, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: .zero, blur: 30, color: c(0x000000, 1))
ctx.addPath(body); ctx.setFillColor(c(0xE6E6E6)); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(body); ctx.clip()
let bodyGrad = CGGradient(colorsSpace: cs, colors: [c(0xFFFFFF), c(0xD9D9D9), c(0xA8A8A8)] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(bodyGrad, start: CGPoint(x: 372, y: 440), end: CGPoint(x: 652, y: 940), options: [])
ctx.restoreGState()

// tasti: rotella grande, poi griglia di punti
func circle(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ col: CGColor) {
  ctx.setFillColor(col); ctx.fillEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r))
}
circle(512, 590, 70, c(0x111111))
circle(512, 590, 30, c(0x2C2C2E))
circle(512, 590, 12, c(0xF7931A))
for row in 0..<2 { for col in 0..<3 {
  circle(452 + CGFloat(col) * 60, 718 + CGFloat(row) * 62, 19, c(0x1C1C1E))
}}
let pill = CGPath(roundedRect: CGRect(x: 462, y: 852, width: 100, height: 26), cornerWidth: 13, cornerHeight: 13, transform: nil)
ctx.addPath(pill); ctx.setFillColor(c(0x1C1C1E)); ctx.fillPath()

let img = ctx.makeImage()!
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil); CGImageDestinationFinalize(dest)
