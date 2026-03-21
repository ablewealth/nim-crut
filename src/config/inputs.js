import { defaultSection7520PresetId, section7520RatePresets } from '../data/section7520Rates.js';

export const tooltips = {
    useDAF: 'Toggle to model a pre-sale contribution to a Donor-Advised Fund (DAF), which avoids capital gains and provides an immediate tax deduction.',
    dafContributionPercentage: 'The percentage of the total asset value to be donated to the DAF before the remainder is contributed to the CRUT.',
    useNingTrust: 'Models the effect of using a Nevada Incomplete Gift Non-Grantor (NING) Trust to potentially avoid state income tax on CRUT distributions.',
    residenceStateTaxRate: 'The client\'s state income tax rate (e.g., NJ, CA). This is used to calculate the potential tax savings from a NING Trust.',
    ningStateTaxRate: 'The tax rate of the state where the NING trust is domiciled (typically 0% for states like Nevada or Delaware).',
    includeNIIT: 'Toggle to include the 3.8% Net Investment Income Tax. For an active business sale, this may not apply, but a trust-based sale could trigger it. This is a critical variable for a professional to assess.',
    niitThreshold: 'The modified adjusted gross income (MAGI) threshold above which the NIIT may apply.',
    initialContribution: 'The fair market value of the asset(s) before any charitable contributions.',
    assetBasis: 'The original purchase price of the contributed asset, used for calculating capital gains tax.',
    grantorAge: 'The age of the income beneficiary at the time of the trust\'s creation.',
    termType: 'Choose whether the trust lasts for a fixed number of years or for the grantor\'s lifetime (calculated based on IRS tables).',
    trustTerm: 'The total duration of the trust in years (only applicable if "Term of Years" is selected).',
    payoutRate: 'The fixed percentage of the trust\'s value paid out to the beneficiary each year.',
    preFlipIncomeYield: 'The portion of pre-flip return that is treated as distributable trust accounting income before the flip.',
    preFlipGrowthRate: 'The projected annual capital appreciation rate of the illiquid asset before the flip.',
    postFlipIncomeYield: 'The portion of the total return generated as income (dividends, interest) after the flip.',
    postFlipCapAppreciation: 'The portion of the total return from asset value growth after the flip.',
    payoutSchedule: 'The frequency of payments to the beneficiary (e.g., Annual, Quarterly).',
    flipTriggerYear: 'The year in which the trust converts from a NIMCRUT to a standard CRUT, allowing for full payouts.',
    grantorOrdinaryTaxRate: 'The grantor\'s marginal income tax rate, used to calculate the value of the charitable deduction.',
    capitalGainsTaxRate: 'The tax rate applied to the profit from selling the asset.',
    section7520RateMode: 'Choose whether to use the current IRS preset rates or a manual Section 7520 override.',
    section7520RatePreset: 'Select the current month or one of the two prior IRS Section 7520 rates.',
    additionalContributionAmount: 'A future, one-time contribution to the trust.',
    additionalContributionYear: 'The year in which the additional contribution is made.',
    grantorAGI: 'The Grantor\'s Adjusted Gross Income. Used to calculate the 30% AGI limitation for DAF contributions.',
    applyAGILimitation: 'Toggle to apply the 30% AGI limitation on the DAF charitable deduction. Any unused deduction can be carried forward for up to 5 years.',
    applyCRUTAGILimitation: 'Toggle to apply the 30% AGI limitation on the CRUT charitable deduction. Note: Trusts typically do NOT have AGI limitations, but this option allows for conservative modeling.',
    useManagementFee: 'Toggle to include annual management fees charged to the trust. These fees reduce the trust\'s growth and available distributions.',
    managementFeeRate: 'The annual management fee rate charged to the trust, calculated as a percentage of trust assets. This fee is deducted before calculating investment growth.'
};

export const inputsConfig = [
    { id: 'useDAF', label: 'Use DAF Pre-Sale Strategy', type: 'toggle', value: false, section: 'Strategy' },
    { id: 'dafContributionPercentage', label: 'DAF Contribution %', type: 'slider', value: 10, min: 1, max: 30, step: 1, format: 'percent', section: 'Strategy', dependsOn: 'useDAF' },
    { id: 'grantorAGI', label: 'Grantor\'s AGI', type: 'number', value: 500000, min: 0, max: 10000000, step: 10000, format: 'currency', section: 'Strategy', dependsOn: 'useDAF' },
    { id: 'applyAGILimitation', label: 'Apply 30% AGI Limit (DAF)', type: 'toggle', value: false, section: 'Strategy', dependsOn: 'useDAF' },
    { id: 'applyCRUTAGILimitation', label: 'Apply 30% AGI Limit (CRUT)', type: 'toggle', value: false, section: 'Strategy' },

    { id: 'useManagementFee', label: 'Include Management Fees', type: 'toggle', value: false, section: 'Strategy' },
    { id: 'managementFeeRate', label: 'Annual Management Fee Rate', type: 'slider', value: 0.50, min: 0, max: 3, step: 0.01, format: 'percent', section: 'Strategy', dependsOn: 'useManagementFee' },

    { id: 'useNingTrust', label: 'Use NING Trust Strategy', type: 'toggle', value: false, section: 'Strategy' },
    { id: 'residenceStateTaxRate', label: 'Residence State Tax Rate', type: 'slider', value: 10.75, min: 0, max: 15, step: 0.01, format: 'percent', section: 'Strategy', dependsOn: 'useNingTrust' },
    { id: 'ningStateTaxRate', label: 'NING State Tax Rate', type: 'slider', value: 0, min: 0, max: 15, step: 0.1, format: 'percent', section: 'Strategy', dependsOn: 'useNingTrust' },
    { id: 'includeNIIT', label: 'Include NIIT on Sale', type: 'toggle', value: false, section: 'Strategy', dependsOn: 'useNingTrust' },
    { id: 'niitThreshold', label: 'NIIT MAGI Threshold', type: 'number', value: 250000, min: 0, max: 1000000, step: 10000, format: 'currency', section: 'Strategy', dependsOn: 'useNingTrust' },

    { id: 'initialContribution', label: 'Total Asset Value', type: 'number', value: 10000000, min: 10000, max: 50000000, step: 10000, format: 'currency', section: 'Asset' },
    { id: 'assetBasis', label: 'Asset Basis', type: 'number', value: 200000, min: 0, max: 50000000, step: 10000, format: 'currency', section: 'Asset' },
    { id: 'additionalContributionAmount', label: 'Additional Contribution Amount', type: 'number', value: 0, min: 0, max: 5000000, step: 10000, format: 'currency', section: 'Asset' },
    { id: 'additionalContributionYear', label: 'Year of Additional Contribution', type: 'slider', value: 5, min: 2, max: 40, step: 1, format: 'integer', section: 'Asset' },

    { id: 'grantorAge', label: 'Grantor Age', type: 'slider', value: 65, min: 20, max: 95, step: 1, format: 'integer', section: 'Trust' },
    { id: 'termType', label: 'Term Type', type: 'select', options: ['Term of Years', 'Life Expectancy'], value: 'Term of Years', section: 'Trust' },
    { id: 'trustTerm', label: 'Term of Years', type: 'slider', value: 20, min: 1, max: 40, step: 1, format: 'integer', section: 'Trust', dependsOn: 'termType', dependsOnValue: 'Term of Years' },
    { id: 'payoutRate', label: 'Payout Rate', type: 'slider', value: 7.50, min: 5, max: 15, step: 0.01, format: 'percent', section: 'Trust' },
    { id: 'payoutSchedule', label: 'Payout Schedule', type: 'select', options: ['Annual', 'Semi-Annual', 'Quarterly', 'Monthly'], value: 'Annual', section: 'Trust' },
    { id: 'flipTriggerYear', label: 'Flip Trigger Year', type: 'slider', value: 5, min: 1, max: 40, step: 1, format: 'integer', section: 'Trust' },

    { id: 'preFlipIncomeYield', label: 'Pre-Flip Income Yield', type: 'slider', value: 0.00, min: 0, max: 10, step: 0.1, format: 'percent', section: 'Performance' },
    { id: 'preFlipGrowthRate', label: 'Pre-Flip Growth Rate', type: 'slider', value: 8.00, min: 0, max: 20, step: 0.01, format: 'percent', section: 'Performance' },
    { id: 'postFlipIncomeYield', label: 'Post-Flip Income Yield', type: 'slider', value: 2.00, min: 0, max: 15, step: 0.1, format: 'percent', section: 'Performance' },
    { id: 'postFlipCapAppreciation', label: 'Post-Flip Capital Appreciation', type: 'slider', value: 6.00, min: 0, max: 15, step: 0.1, format: 'percent', section: 'Performance' },

    { id: 'grantorOrdinaryTaxRate', label: 'Ordinary Income Tax Rate', type: 'slider', value: 37, min: 10, max: 50, step: 1, format: 'percent', section: 'Tax' },
    { id: 'capitalGainsTaxRate', label: 'Capital Gains Tax Rate', type: 'slider', value: 20, min: 0, max: 30, step: 1, format: 'percent', section: 'Tax' },
    { id: 'section7520RateMode', label: 'Section 7520 Source', type: 'select', options: ['IRS Preset', 'Manual Override'], value: 'IRS Preset', section: 'Tax' },
    { id: 'section7520RatePreset', label: 'Section 7520 Preset', type: 'select', options: section7520RatePresets.map((preset) => preset.label), value: section7520RatePresets.find((preset) => preset.id === defaultSection7520PresetId).label, section: 'Tax', dependsOn: 'section7520RateMode', dependsOnValue: 'IRS Preset' },
    { id: 'section_7520_rate', label: 'Section 7520 Rate', type: 'slider', value: 4.8, min: 0.2, max: 8, step: 0.2, format: 'percent', section: 'Tax', dependsOn: 'section7520RateMode', dependsOnValue: 'Manual Override' }
];

function coerceByType(config, value) {
    if (config.type === 'toggle') {
        if (typeof value === 'string') {
            return value === 'true';
        }
        return Boolean(value);
    }

    if (config.type === 'number' || config.type === 'slider') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : config.value;
    }

    return typeof value === 'string' ? value : config.value;
}

export function buildDefaultInputs() {
    return Object.fromEntries(inputsConfig.map((config) => [config.id, config.value]));
}

export function normalizeInputs(rawInputs = {}) {
    const defaults = buildDefaultInputs();

    return inputsConfig.reduce((accumulator, config) => {
        const incomingValue = Object.prototype.hasOwnProperty.call(rawInputs, config.id)
            ? rawInputs[config.id]
            : defaults[config.id];

        accumulator[config.id] = coerceByType(config, incomingValue);
        return accumulator;
    }, {});
}
