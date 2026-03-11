/**
 * 统一提示：若已安装 react-hot-toast 则用 toast，否则 fallback 到 alert
 */
let toastFn: ((msg: string, opts?: { icon?: string }) => void) | null = null

export function setToast(fn: typeof toastFn) {
  toastFn = fn
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (toastFn) {
    toastFn(message, { icon: type === 'error' ? '❌' : type === 'success' ? '✓' : undefined })
    return
  }
  if (type === 'error') alert(message)
  else if (type === 'success') alert(message)
  else alert(message)
}

// 添加便捷方法
toast.error = (message: string) => toast(message, 'error')
toast.success = (message: string) => toast(message, 'success')
toast.info = (message: string) => toast(message, 'info')
