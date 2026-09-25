// Turns a folder of numbered JPEG frames into an H.264 mp4 (AVFoundation, no ffmpeg needed).
//   swift encode.swift <framesDir> <fps> <out.mp4>
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 4, let fps = Int32(args[2]) else {
    print("usage: swift encode.swift <framesDir> <fps> <out.mp4>")
    exit(1)
}
let dir = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[3])

let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "jpg" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = files.first,
      let firstSource = CGImageSourceCreateWithURL(first as CFURL, nil),
      let firstImage = CGImageSourceCreateImageAtIndex(firstSource, 0, nil) else {
    print("no frames found in \(dir.path)")
    exit(1)
}
let width = firstImage.width
let height = firstImage.height

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 10_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: fps,
        AVVideoExpectedSourceFrameRateKey: fps,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ])
writer.add(input)
writer.shouldOptimizeForNetworkUse = true
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let space = CGColorSpace(name: CGColorSpace.sRGB)!
for (index, file) in files.enumerated() {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let pool = adaptor.pixelBufferPool else { continue }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let pixels = buffer else { continue }
    CVPixelBufferLockBaseAddress(pixels, [])
    let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixels), width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixels), space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(pixels, [])
    adaptor.append(pixels, withPresentationTime: CMTime(value: Int64(index), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("encoded \(files.count) frames \(width)x\(height) @\(fps) fps -> \(out.path)  status=\(writer.status.rawValue) error=\(String(describing: writer.error))")
