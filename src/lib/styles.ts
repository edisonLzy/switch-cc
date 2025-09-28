// 统一的按钮样式
export const buttonStyles = {
  primary: `
    px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg 
    transition-colors duration-200 font-medium text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  secondary: `
    px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg 
    transition-colors duration-200 font-medium text-sm border border-gray-300
    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 dark:border-gray-600
  `,
  danger: `
    px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg 
    transition-colors duration-200 font-medium text-sm
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  icon: `
    p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg 
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
  `,
  ghost: `
    px-3 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded 
    transition-colors duration-200 text-sm
    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-disabled
    dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
  `
};

// 输入框样式
export const inputStyles = {
  base: `
    w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    disabled:bg-gray-100 disabled:cursor-not-allowed
    dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200
    dark:focus:ring-blue-400 dark:disabled:bg-gray-700
  `,
  error: `
    w-full px-3 py-2 border border-red-300 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
    disabled:bg-gray-100 disabled:cursor-not-allowed
    dark:bg-gray-800 dark:border-red-600 dark:text-gray-200
    dark:focus:ring-red-400 dark:disabled:bg-gray-700
  `
};

// 卡片样式
export const cardStyles = {
  base: `
    bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700
    shadow-sm hover:shadow-md transition-shadow duration-200
  `,
  interactive: `
    bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700
    shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
    hover:border-blue-300 dark:hover:border-blue-600
  `
};

// 模态框样式
export const modalStyles = {
  backdrop: `
    fixed inset-0 bg-black/50 backdrop-blur-sm z-40
    flex items-center justify-center p-4
  `,
  content: `
    bg-white dark:bg-gray-900 rounded-xl shadow-2xl
    border border-gray-200 dark:border-gray-700
    max-w-md w-full max-h-[90vh] overflow-y-auto
  `
};