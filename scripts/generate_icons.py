import os
import Cocoa
from Cocoa import NSImage, NSBitmapImageRep, NSGraphicsContext, NSColor, NSBezierPath, NSPoint, NSRect, NSSize, NSPNGFileType

def create_shield_icon(size, output_path):
    image = NSImage.alloc().initWithSize_(NSSize(size, size))
    image.lockFocus()

    ctx = NSGraphicsContext.currentContext()
    ctx.setShouldAntialias_(True)

    # Scale coordinates
    s = size / 128.0

    # Draw rounded shield background
    path = NSBezierPath.bezierPath()
    # Shield shape coordinates (scaled for 128x128)
    path.moveToPoint_(NSPoint(64 * s, 6 * s)) # bottom tip
    path.curveToPoint_controlPoint1_controlPoint2_(
        NSPoint(16 * s, 42 * s),
        NSPoint(36 * s, 10 * s),
        NSPoint(16 * s, 26 * s)
    )
    path.lineToPoint_(NSPoint(16 * s, 104 * s))
    path.curveToPoint_controlPoint1_controlPoint2_(
        NSPoint(64 * s, 122 * s),
        NSPoint(16 * s, 114 * s),
        NSPoint(40 * s, 122 * s)
    )
    path.curveToPoint_controlPoint1_controlPoint2_(
        NSPoint(112 * s, 104 * s),
        NSPoint(88 * s, 122 * s),
        NSPoint(112 * s, 114 * s)
    )
    path.lineToPoint_(NSPoint(112 * s, 42 * s))
    path.curveToPoint_controlPoint1_controlPoint2_(
        NSPoint(64 * s, 6 * s),
        NSPoint(112 * s, 26 * s),
        NSPoint(92 * s, 10 * s)
    )
    path.closePath()

    # Red/Crimson gradient-like fill
    NSColor.colorWithCalibratedRed_green_blue_alpha_(0.9, 0.05, 0.1, 1.0).setFill()
    path.fill()

    # Border
    NSColor.colorWithCalibratedRed_green_blue_alpha_(1.0, 0.25, 0.25, 0.8).setStroke()
    path.setLineWidth_(4 * s)
    path.stroke()

    # Draw Cinema Play Icon / Checkmark inside
    play_path = NSBezierPath.bezierPath()
    play_path.moveToPoint_(NSPoint(50 * s, 85 * s))
    play_path.lineToPoint_(NSPoint(86 * s, 64 * s))
    play_path.lineToPoint_(NSPoint(50 * s, 43 * s))
    play_path.closePath()

    NSColor.whiteColor().setFill()
    play_path.fill()

    image.unlockFocus()

    # Export to PNG
    tiff_data = image.TIFFRepresentation()
    bitmap = NSBitmapImageRep.imageRepsWithData_(tiff_data)[0]
    png_data = bitmap.representationUsingType_properties_(NSPNGFileType, None)
    png_data.writeToFile_atomically_(output_path, True)
    print(f"Generated icon: {output_path} ({size}x{size})")

os.makedirs('extension/icons', exist_ok=True)
for sz in [16, 32, 48, 128]:
    create_shield_icon(sz, f'extension/icons/icon{sz}.png')
