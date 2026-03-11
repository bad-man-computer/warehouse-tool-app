import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

// 预设的常见工具分类（国际化）
export const PREDEFINED_CATEGORIES = [
  {
    id: 'predefined-hand-tools',
    name_zh: '手动工具',
    name_en: 'Hand Tools',
    items: ['螺丝刀', '扳手', '钳子', '锤子', '剪刀', '美工刀']
  },
  {
    id: 'predefined-power-tools',
    name_zh: '电动工具',
    name_en: 'Power Tools',
    items: ['电钻', '电锯', '砂光机', '角磨机', '电锤', '热风枪']
  },
  {
    id: 'predefined-measuring-tools',
    name_zh: '测量工具',
    name_en: 'Measuring Tools',
    items: ['卷尺', '游标卡尺', '水平尺', '角度尺', '测距仪', '千分尺']
  },
  {
    id: 'predefined-cutting-tools',
    name_zh: '切割工具',
    name_en: 'Cutting Tools',
    items: ['刀具', '锯片', '切割机', '激光切割机']
  },
  {
    id: 'predefined-safety-equipment',
    name_zh: '安全防护',
    name_en: 'Safety Equipment',
    items: ['安全帽', '护目镜', '防护手套', '耳塞', '口罩', '安全带']
  },
  {
    id: 'predefined-storage',
    name_zh: '存储容器',
    name_en: 'Storage',
    items: ['工具箱', '零件盒', '货架', '储物柜']
  },
  {
    id: 'predefined-fasteners',
    name_zh: '紧固件',
    name_en: 'Fasteners',
    items: ['螺丝', '螺母', '垫片', '钉子', '膨胀管']
  },
  {
    id: 'predefined-adhesives',
    name_zh: '胶粘用品',
    name_en: 'Adhesives',
    items: ['胶水', '胶带', '双面胶', '绝缘胶带']
  },
  {
    id: 'predefined-painting',
    name_zh: '油漆涂料',
    name_en: 'Painting Supplies',
    items: ['油漆', '刷子', '滚筒', '喷漆', '稀释剂']
  },
  {
    id: 'predefined-plumbing',
    name_zh: '水暖工具',
    name_en: 'Plumbing Tools',
    items: ['管钳', '水管', '阀门', '接头', '密封胶']
  },
  {
    id: 'predefined-electrical',
    name_zh: '电工工具',
    name_en: 'Electrical Tools',
    items: ['万用表', '电笔', '剥线钳', '压线钳', '焊锡丝', '电工胶带']
  },
  {
    id: 'predefined-automotive',
    name_zh: '汽车维修',
    name_en: 'Automotive Tools',
    items: ['千斤顶', '套筒扳手', '扭力扳手', '火花塞扳手']
  },
  {
    id: 'predefined-garden',
    name_zh: '园艺工具',
    name_en: 'Garden Tools',
    items: ['铲子', '锄头', '修枝剪', '洒水壶', '割草机']
  },
  {
    id: 'predefined-cleaning',
    name_zh: '清洁用品',
    name_en: 'Cleaning Supplies',
    items: ['扫帚', '拖把', '抹布', '清洁剂', '垃圾桶']
  },
  {
    id: 'predefined-office',
    name_zh: '办公用品',
    name_en: 'Office Supplies',
    items: ['订书机', '剪刀', '文件夹', '标签打印机']
  },
  {
    id: 'predefined-other',
    name_zh: '其他工具',
    name_en: 'Other Tools',
    items: []
  }
]

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  existingCategories?: Array<{ id: string; name_zh: string; name_en: string }>
}

export function CategorySelector({ value, onChange, existingCategories = [] }: CategorySelectorProps) {
  const { t, i18n } = useTranslation()
  const [selectedMode, setSelectedMode] = useState<'preset' | 'existing' | 'custom'>('preset')
  const [customCategory, setCustomCategory] = useState('')
  const [showSubItems, setShowSubItems] = useState<string | null>(null)

  // 如果是现有分类 ID，自动切换到 existing 模式
  useEffect(() => {
    if (value && !value.startsWith('predefined-') && !value.startsWith('custom-')) {
     setSelectedMode('existing')
    } else if (value?.startsWith('custom-')) {
     setSelectedMode('custom')
     setCustomCategory(value.replace('custom-', ''))
    } else if (value?.startsWith('predefined-')) {
     setSelectedMode('preset')
    }
  }, [value])

  const isLangEn = i18n.language === 'en'

  const handlePresetSelect = (categoryId: string, itemName?: string) => {
   if (itemName) {
      // 如果选择了预设分类下的具体项目，使用 "分类：项目" 格式
      onChange(`${categoryId}:${itemName}`)
    } else {
      // 只选择大类，直接使用 categoryId (已经是 predefined-xxx 格式)
      onChange(categoryId)
    }
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   const val = e.target.value
   setCustomCategory(val)
    onChange(`custom-${val}`)
  }

 return (
    <div className="space-y-3">
      {/* 模式选择 */}
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setSelectedMode('preset')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
           selectedMode === 'preset'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('tool.commonCategories')}
        </button>
        {existingCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedMode('existing')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
             selectedMode === 'existing'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('tool.myCategories')} ({existingCategories.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setSelectedMode('custom')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
           selectedMode === 'custom'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus size={14} />
          {t('tool.customCategory')}
        </button>
      </div>

      {/* 预设分类 */}
      {selectedMode === 'preset' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
          {PREDEFINED_CATEGORIES.map((category) => (
            <div key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (category.items.length > 0) {
                   setShowSubItems(showSubItems === category.id ? null : category.id)
                  } else {
                    handlePresetSelect(category.id)
                  }
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  value === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {isLangEn ? category.name_en : category.name_zh}
              </button>
              
              {/* 子项目列表 */}
              {showSubItems === category.id && category.items.length > 0 && (
                <div className="ml-1 space-y-0.5 mt-1 pl-2 border-l-2 border-primary-300">
                  {category.items.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetSelect(category.id, item)}
                      className={`block w-full text-left px-1.5 py-0.5 text-xs rounded transition-colors ${
                        value === `predefined-${category.id}:${item}`
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {isLangEn ? item : item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 现有分类 */}
      {selectedMode === 'existing' && existingCategories.length > 0 && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">{t('tool.selectCategory')}</option>
          {existingCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {(isLangEn ? c.name_en : c.name_zh) || c.id}
            </option>
          ))}
        </select>
      )}

      {/* 自定义分类 */}
      {selectedMode === 'custom' && (
        <input
          type="text"
          value={customCategory}
          onChange={handleCustomChange}
          placeholder={isLangEn ? 'Enter custom category name' : '输入自定义分类名称'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          autoFocus
        />
      )}

      {/* 当前选择提示 */}
      {value && (
        <p className="text-xs text-gray-500">
          {t('tool.currentCategory')}: <span className="font-medium">{
            value.startsWith('custom-') 
              ? value.replace('custom-', '')
              : value.startsWith('predefined-')
                ? PREDEFINED_CATEGORIES.find(c => `predefined-${c.id}` === value)?.[isLangEn ? 'name_en' : 'name_zh'] || value
                : existingCategories.find(c => c.id === value)?.[isLangEn ? 'name_en' : 'name_zh'] || value
          }</span>
        </p>
      )}
    </div>
  )
}
