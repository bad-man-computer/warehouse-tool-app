import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Upload, X, Image } from 'lucide-react'

interface PhotoUploaderProps {
  photos: string[]
  onChange: (photos: string[]) => void
}

export function PhotoUploader({ photos = [], onChange }: PhotoUploaderProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // 处理文件选择
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    setUploading(true)
    try {
      const newPhotos: string[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // 验证文件类型
        if (!file || !file.type.startsWith('image/')) {
          continue
        }
        
        // 压缩并转换为 Base64
        const base64 = await compressAndConvert(file)
        newPhotos.push(base64)
      }
      
      // 添加到现有照片列表
      onChange([...photos, ...newPhotos])
    } catch (error) {
      console.error('Photo upload failed:', error)
    } finally {
      setUploading(false)
      // 清空 input，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 压缩图片并转换为 Base64
  const compressAndConvert = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // 最大尺寸限制（避免图片过大）
          const MAX_WIDTH = 1920
          const MAX_HEIGHT = 1920
          let width = img.width
          let height = img.height
          
          // 计算缩放比例
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height)
            width = Math.floor(width * ratio)
            height = Math.floor(height * ratio)
          }
          
          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)
          
          // 转换为 JPEG，质量 0.8
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  // 触发文件选择
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // 调用摄像头拍照
  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // 使用后置摄像头
      })
      
      // 创建临时对话框显示摄像头画面
      const photo = await takePhotoFromStream(stream)
      
      // 停止所有轨道
      stream.getTracks().forEach(track => track.stop())
      
      // 添加到照片列表
      onChange([...photos, photo])
    } catch (error) {
      console.error('Camera capture failed:', error)
    }
  }

  // 从流中拍照
  const takePhotoFromStream = async (stream: MediaStream): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.srcObject = stream
      
      video.onloadedmetadata = () => {
        video.play()
        
        setTimeout(() => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(video, 0, 0)
          
          // 转换为 JPEG
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }, 500) // 延迟 500ms 确保画面清晰
      }
    })
  }

  // 删除照片
  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    onChange(newPhotos)
  }

  return (
    <div className="space-y-3">
      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          {t('tool.uploadFromGallery')}
        </button>
        
        <button
          type="button"
          onClick={handleCameraCapture}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          {t('tool.takePhoto')}
        </button>
      </div>
      
      {/* 隐藏的文件输入框 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* 照片预览 */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photoUrl, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
              <img
                src={photoUrl}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* 空状态提示 */}
      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Image size={48} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('tool.noPhotos')}</p>
        </div>
      )}
    </div>
  )
}
