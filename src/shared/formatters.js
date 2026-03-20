export const formatters = {
    currency: (val) => `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    percent: (val) => `${Number(val).toFixed(2)}%`,
    integer: (val) => `${val}`
};
