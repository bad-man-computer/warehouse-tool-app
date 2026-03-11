/**
 * 将表格数据导出为 CSV 并触发下载
 * @param rows 二维数组，第一行为表头
 * @param filename 下载文件名（不含扩展名）
 */
export function exportCsv(rows: string[][], filename: string) {
  const BOM = '\uFEFF'
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
          return s
        })
        .join(',')
    )
    .join('\r\n')
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
