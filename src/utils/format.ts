/**
 * 日期时间格式化与解析
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

/** 用于 input datetime-local 的 value */
export function toInputDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 当前时间 + days 的 ISO 字符串，用于默认预计归还 */
export function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 16)
}

/**
 * 计算逾期天数（expected_return 已过且未还）
 */
export function overdueDays(expectedReturnAt: string): number {
  const expected = new Date(expectedReturnAt).getTime()
  const now = Date.now()
  if (now <= expected) return 0
  return Math.floor((now - expected) / (24 * 60 * 60 * 1000))
}
