export const section7520RatePresets = [
    {
        id: '2026-03',
        label: 'March 2026 (IRS 4.8%)',
        rate: 4.8,
        revenueRuling: 'Rev. Rul. 2026-6',
        source: 'IRS Section 7520 interest rates page'
    },
    {
        id: '2026-02',
        label: 'February 2026 (IRS 4.6%)',
        rate: 4.6,
        revenueRuling: 'Rev. Rul. 2026-3',
        source: 'IRS Section 7520 interest rates page'
    },
    {
        id: '2026-01',
        label: 'January 2026 (IRS 4.6%)',
        rate: 4.6,
        revenueRuling: 'Rev. Rul. 2026-2',
        source: 'IRS Section 7520 interest rates page'
    }
];

export const defaultSection7520PresetId = section7520RatePresets[0].id;

export function findSection7520RatePreset(presetReference) {
    return section7520RatePresets.find((preset) => preset.id === presetReference || preset.label === presetReference) ?? section7520RatePresets[0];
}
