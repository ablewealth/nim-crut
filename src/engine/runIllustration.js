import { normalizeInputs } from '../config/inputs.js';
import { findSection7520RatePreset } from '../data/section7520Rates.js';
import { validateInputs } from './validateInputs.js';

const LIFE_EXPECTANCY_TABLE = {
    20: 61,
    25: 56,
    30: 51,
    35: 46,
    40: 41,
    45: 37,
    50: 32,
    55: 28,
    60: 23,
    65: 19,
    70: 15,
    75: 11,
    80: 8,
    85: 6,
    90: 4,
    95: 3
};

const PAYOUT_FREQUENCY_FACTORS = {
    Annual: 1.0,
    'Semi-Annual': 0.9878,
    Quarterly: 0.9758,
    Monthly: 0.9642
};

function calculateLifeExpectancyTerm(grantorAge) {
    const ages = Object.keys(LIFE_EXPECTANCY_TABLE).map(Number).sort((a, b) => a - b);
    const minAge = ages[0];
    const maxAge = ages[ages.length - 1];

    // Clamp to the supported range, then linearly interpolate between the two
    // bracketing anchor ages instead of snapping to the nearest one. This keeps
    // the term continuous across ages; it is still an approximation pending
    // integration of IRS Mortality Table 2010CM (see REBUILD_BACKLOG Task 2.3).
    if (grantorAge <= minAge) {
        return LIFE_EXPECTANCY_TABLE[minAge];
    }
    if (grantorAge >= maxAge) {
        return LIFE_EXPECTANCY_TABLE[maxAge];
    }

    const lowerAge = ages.filter((age) => age <= grantorAge).pop();
    const upperAge = ages.find((age) => age > grantorAge);
    const lowerTerm = LIFE_EXPECTANCY_TABLE[lowerAge];
    const upperTerm = LIFE_EXPECTANCY_TABLE[upperAge];
    const fraction = (grantorAge - lowerAge) / (upperAge - lowerAge);
    const interpolatedTerm = lowerTerm + (upperTerm - lowerTerm) * fraction;

    return Math.round(interpolatedTerm);
}

function calculateTermCertainRemainderFactor(term, adjustedPayoutRate) {
    // Term-of-years CRUT remainder factor per Treas. Reg. 1.664-4 (Table D):
    // the remainder interest equals (1 - adjusted payout rate) ^ term. It is an
    // exact, closed-form value and does not depend on the section 7520 rate or
    // the beneficiary's age.
    return Math.max(0, Math.min(1, Math.pow(1 - adjustedPayoutRate, term)));
}

function calculateLifeRemainderFactor(age, term, adjustedPayoutRate, rate7520) {
    // Coarse approximation retained for life-based trusts pending 2010CM
    // actuarial table integration (see docs/REBUILD_BACKLOG.md Task 2.3).
    const pvAnnuityFactor = (1 - Math.pow(1 + rate7520, -term)) / rate7520;
    const beneficiaryInterest = pvAnnuityFactor * adjustedPayoutRate;
    const remainderFactor = Math.max(0, 1 - beneficiaryInterest);
    const ageAdjustment = (age - 65) * 0.002;

    return Math.min(0.95, Math.max(0.1, remainderFactor + ageAdjustment));
}

function createValidationResponse(inputs, validation) {
    return {
        error: validation.errors.join(' '),
        inputs,
        validation,
        annual_ledger: [],
        projection_data: []
    };
}

function calculateSimplifiedNiit({ gainAmount, grantorAGI, niitThreshold, niitRate }) {
    const taxableExcess = Math.max(0, (grantorAGI + gainAmount) - niitThreshold);
    const taxableGain = Math.min(gainAmount, taxableExcess);

    return {
        taxableGain,
        tax: taxableGain * niitRate
    };
}

function buildDisclosures({ termType, payoutSchedule, useNingTrust, includeNIIT, additionalContributionAmount }) {
    const disclosures = [
        'Unitrust payments are calculated on the beginning-of-year trust value. The "Value Before Payment" ledger column is shown for reference and is not the payout base.',
        'Total Benefit aggregates undiscounted multi-year cash distributions with present-value upfront tax savings and is shown before the beneficiary\'s income tax on distributions; the figures are not time-value adjusted.'
    ];

    if (termType === 'Life Expectancy') {
        disclosures.push('Life-based term is interpolated from an approximate life-expectancy table and is not derived from IRS Mortality Table 2010CM; verify before relying on life-based results.');
    }

    if (payoutSchedule && payoutSchedule !== 'Annual') {
        disclosures.push('Payment-frequency adjustment uses fixed approximations of IRS Publication 1458 Table F and does not vary with the section 7520 rate.');
    }

    if (includeNIIT) {
        disclosures.push('The 3.8% NIIT is applied only to the outright-sale benchmark. The CRUT is income-tax exempt on the asset sale under IRC 664(c); NIIT on the character of distributions to the beneficiary is not modeled.');
    }

    if (useNingTrust) {
        disclosures.push('NING state-tax savings assume the entire distribution is subject to the residence-state rate. Distribution character tiers (e.g., return of corpus) are not modeled, which may overstate the savings.');
    }

    if (additionalContributionAmount > 0) {
        disclosures.push('Additional contributions increase trust corpus but do not generate an incremental charitable deduction and are not re-tested against the 10% remainder requirement.');
    }

    disclosures.push('Outright-sale benchmark compounds after-capital-gains-tax proceeds at the post-flip net return with no annual income-tax drag; it is a pre-personal-income-tax comparison.');

    return disclosures;
}

export function runIllustration(rawInputs = {}) {
    const inputs = normalizeInputs(rawInputs);
    const validation = validateInputs(inputs);

    if (validation.errors.length > 0) {
        return createValidationResponse(inputs, validation);
    }

    const selectedSection7520Preset = findSection7520RatePreset(inputs.section7520RatePreset);
    const appliedSection7520Rate = inputs.section7520RateMode === 'IRS Preset'
        ? selectedSection7520Preset.rate
        : inputs.section_7520_rate;
    const section7520SelectionLabel = inputs.section7520RateMode === 'IRS Preset'
        ? selectedSection7520Preset.label
        : 'Manual Override';

    let {
        initialContribution,
        assetBasis,
        grantorAge,
        termType,
        trustTerm,
        payoutRate,
        preFlipIncomeYield,
        preFlipGrowthRate,
        postFlipIncomeYield,
        postFlipCapAppreciation,
        flipTriggerYear,
        flipTreatmentMode,
        payoutSchedule,
        grantorOrdinaryTaxRate,
        capitalGainsTaxRate,
        useDAF,
        dafContributionPercentage,
        useNingTrust,
        residenceStateTaxRate,
        ningStateTaxRate,
        includeNIIT,
        niitThreshold,
        useManagementFee,
        managementFeeRate,
        additionalContributionAmount,
        additionalContributionYear,
        grantorAGI,
        applyAGILimitation,
        applyCRUTAGILimitation
    } = inputs;

    if (termType === 'Life Expectancy') {
        trustTerm = calculateLifeExpectancyTerm(grantorAge);
    }

    // Term-of-years trusts are already checked against this rule in
    // validateInputs. Life-expectancy trusts derive the term here, so this is
    // the only place the constraint can be enforced for them.
    if (termType === 'Life Expectancy' && flipTriggerYear >= trustTerm) {
        return createValidationResponse(inputs, {
            errors: ['Flip trigger year must be earlier than the calculated trust term so a post-flip year exists.'],
            warnings: validation.warnings
        });
    }

    const payoutRateDec = payoutRate / 100;
    const preFlipIncomeYieldDec = preFlipIncomeYield / 100;
    const preFlipGrowthRateDec = preFlipGrowthRate / 100;
    const postFlipIncomeYieldDec = postFlipIncomeYield / 100;
    const postFlipCapAppreciationDec = postFlipCapAppreciation / 100;
    const section7520RateDec = appliedSection7520Rate / 100;
    const grantorOrdinaryTaxRateDec = grantorOrdinaryTaxRate / 100;
    const capitalGainsTaxRateDec = capitalGainsTaxRate / 100;
    const residenceStateTaxRateDec = residenceStateTaxRate / 100;
    const ningStateTaxRateDec = ningStateTaxRate / 100;
    const effectiveStateTaxRateDec = useNingTrust ? Math.max(0, residenceStateTaxRateDec - ningStateTaxRateDec) : 0;
    const clientManagementFeeDec = useManagementFee ? (managementFeeRate / 100) : 0;
    const niitRate = 0.038;

    let dafDonationValue = 0;
    let initialContributionForCRUT = initialContribution;
    let avoidedCapitalGainsOnDAF = 0;
    let dafTaxDeduction = 0;
    let basisForCRUT = assetBasis;
    let dafDeductionUsed = 0;
    let dafDeductionCarriedForward = 0;

    if (useDAF) {
        const dafContributionDec = dafContributionPercentage / 100;
        dafDonationValue = initialContribution * dafContributionDec;
        initialContributionForCRUT = initialContribution - dafDonationValue;

        const basisOfDAFPortion = assetBasis * dafContributionDec;
        basisForCRUT = assetBasis - basisOfDAFPortion;

        avoidedCapitalGainsOnDAF = (dafDonationValue - basisOfDAFPortion) * capitalGainsTaxRateDec;
        dafTaxDeduction = dafDonationValue;
        dafDeductionUsed = dafTaxDeduction;

        if (applyAGILimitation) {
            const agiLimit = grantorAGI * 0.30;
            dafDeductionUsed = Math.min(dafTaxDeduction, agiLimit);
            dafDeductionCarriedForward = dafTaxDeduction - dafDeductionUsed;
        }
    }

    const upfrontTaxSavingsFromDAF = dafDeductionUsed * grantorOrdinaryTaxRateDec;

    const payoutFrequencyFactor = PAYOUT_FREQUENCY_FACTORS[payoutSchedule] ?? PAYOUT_FREQUENCY_FACTORS.Annual;
    const adjustedPayoutRate = payoutRateDec * payoutFrequencyFactor;
    const charitableRemainderFactor = termType === 'Life Expectancy'
        ? calculateLifeRemainderFactor(grantorAge, trustTerm, adjustedPayoutRate, section7520RateDec)
        : calculateTermCertainRemainderFactor(trustTerm, adjustedPayoutRate);
    const presentValueOfRemainder = initialContributionForCRUT * charitableRemainderFactor;

    if ((presentValueOfRemainder / initialContributionForCRUT) < 0.10) {
        return {
            error: `Error: CRUT fails the 10% remainder test. Remainder is only ${((presentValueOfRemainder / initialContributionForCRUT) * 100).toFixed(2)}%. Try lowering the Payout Rate or increasing the Trust Term.`,
            inputs,
            validation,
            annual_ledger: [],
            projection_data: []
        };
    }

    const crutTaxDeduction = presentValueOfRemainder;
    let crutDeductionUsed = crutTaxDeduction;
    let crutDeductionCarriedForward = 0;

    if (applyCRUTAGILimitation) {
        const agiLimit = grantorAGI * 0.30;
        const remainingAGICapacity = Math.max(0, agiLimit - dafDeductionUsed);
        crutDeductionUsed = Math.min(crutTaxDeduction, remainingAGICapacity);
        crutDeductionCarriedForward = crutTaxDeduction - crutDeductionUsed;
    }

    const upfrontTaxSavingsFromCRUT = crutDeductionUsed * grantorOrdinaryTaxRateDec;

    // A CRUT is exempt from income tax (including the 3.8% NIIT) on gains it
    // realizes when the contributed asset is sold (IRC 664(c)). The trust
    // therefore pays no one-time NIIT on the embedded gain. NIIT on the
    // character of distributions carried out to the beneficiary is not modeled;
    // see the disclosures array. NIIT still applies to the outright-sale
    // benchmark below, where the individual sells the asset directly.
    const oneTimeNiitPaid = 0;

    const annual_ledger = [];
    let makeupOwed = 0;
    let beginValue = initialContributionForCRUT;
    let totalStateTaxSaved = 0;
    let cumulativeClientFees = 0;

    for (let year = 1; year <= trustTerm; year += 1) {
        const contributionAdded = year === additionalContributionYear ? additionalContributionAmount : 0;
        if (contributionAdded > 0) {
            beginValue += contributionAdded;
        }

        const makeupOwedStart = makeupOwed;
        const clientFeePaid = beginValue * clientManagementFeeDec;
        cumulativeClientFees += clientFeePaid;

        const growthBase = beginValue - clientFeePaid;
        const isSpecMode = flipTreatmentMode === 'Spec Mode';
        const isPreFlipYear = isSpecMode ? year <= flipTriggerYear : year < flipTriggerYear;
        const phase = isSpecMode
            ? year < flipTriggerYear
                ? 'Pre-Flip NIMCRUT'
                : year === flipTriggerYear
                    ? 'Trigger Year (Pre-Flip Rules)'
                    : year === flipTriggerYear + 1
                        ? 'First Post-Flip CRUT Year'
                        : 'Post-Flip CRUT'
            : year < flipTriggerYear
                ? 'Pre-Flip NIMCRUT'
                : year === flipTriggerYear
                    ? 'Flip Year'
                    : 'Post-Flip CRUT';

        let incomeGenerated;
        let appreciation;
        if (isPreFlipYear) {
            incomeGenerated = growthBase * preFlipIncomeYieldDec;
            appreciation = growthBase * preFlipGrowthRateDec;
        } else {
            incomeGenerated = growthBase * postFlipIncomeYieldDec;
            appreciation = growthBase * postFlipCapAppreciationDec;
        }

        const growth = incomeGenerated + appreciation;
        const valueBeforePayment = beginValue + growth;
        const unitrustAmount = beginValue * payoutRateDec;
        const makeupOwedThisYear = Math.max(0, unitrustAmount - incomeGenerated);

        let actualPayment;
        let makeupPaidThisYear = 0;
        let makeupForfeitedThisYear = 0;
        if (isSpecMode) {
            if (year <= flipTriggerYear) {
                const paymentLimit = incomeGenerated;
                const unitrustDeficit = Math.max(0, unitrustAmount - paymentLimit);
                makeupOwed += unitrustDeficit;
                const excessIncome = Math.max(0, paymentLimit - unitrustAmount);
                makeupPaidThisYear = Math.min(excessIncome, makeupOwed);
                actualPayment = Math.min(unitrustAmount, paymentLimit) + makeupPaidThisYear;
                makeupOwed -= makeupPaidThisYear;
            } else {
                if (year === flipTriggerYear + 1) {
                    makeupForfeitedThisYear = makeupOwed;
                    makeupOwed = 0;
                }
                actualPayment = unitrustAmount;
            }
        } else if (year < flipTriggerYear) {
            const paymentLimit = incomeGenerated;
            const unitrustDeficit = Math.max(0, unitrustAmount - paymentLimit);
            makeupOwed += unitrustDeficit;
            const excessIncome = Math.max(0, paymentLimit - unitrustAmount);
            makeupPaidThisYear = Math.min(excessIncome, makeupOwed);
            actualPayment = Math.min(unitrustAmount, paymentLimit) + makeupPaidThisYear;
            makeupOwed -= makeupPaidThisYear;
        } else if (year === flipTriggerYear) {
            makeupPaidThisYear = makeupOwed + makeupOwedThisYear;
            actualPayment = unitrustAmount + makeupPaidThisYear;
            makeupOwed = 0;
        } else {
            makeupOwed = 0;
            actualPayment = unitrustAmount;
        }

        let stateTaxSavedForYear = 0;
        if (useNingTrust) {
            stateTaxSavedForYear = actualPayment * effectiveStateTaxRateDec;
            totalStateTaxSaved += stateTaxSavedForYear;
        }

        const endValue = beginValue + growth - actualPayment - clientFeePaid;

        annual_ledger.push({
            Year: year,
            Phase: phase,
            'Grantor Age': grantorAge + year - 1,
            'Contribution Added': contributionAdded,
            'Begin Value': beginValue,
            'Client Fee Paid': clientFeePaid,
            'Growth Base': growthBase,
            'Income Generated': incomeGenerated,
            'Capital Appreciation': appreciation,
            Growth: growth,
            'Value Before Payment': valueBeforePayment,
            'Annual Payment Amount': unitrustAmount,
            'Make-Up Owed Start': makeupOwedStart,
            'Make-Up Owed This Year': makeupOwedThisYear,
            'Make-Up Paid This Year': makeupPaidThisYear,
            'Make-Up Forfeited This Year': makeupForfeitedThisYear,
            'Actual Payment Made': actualPayment,
            'State Tax Saved': stateTaxSavedForYear,
            'Cumulative Make-Up Owed': makeupOwed,
            'End Value': endValue
        });

        beginValue = endValue;
    }

    const projection_data = annual_ledger.map((row) => ({
        Year: row.Year,
        Phase: row.Phase,
        'Grantor Age': row['Grantor Age'],
        'Begin Value': row['Begin Value'],
        'Income Generated': row['Income Generated'],
        'Capital Appreciation': row['Capital Appreciation'],
        Growth: row.Growth,
        'Value Before Payment': row['Value Before Payment'],
        'Annual Payment Amount': row['Annual Payment Amount'],
        'Make-Up Owed Start': row['Make-Up Owed Start'],
        'Make-Up Owed This Year': row['Make-Up Owed This Year'],
        'Make-Up Paid This Year': row['Make-Up Paid This Year'],
        'Make-Up Forfeited This Year': row['Make-Up Forfeited This Year'],
        'Client Fee Paid': row['Client Fee Paid'],
        'Actual Payment Made': row['Actual Payment Made'],
        'State Tax Saved': row['State Tax Saved'],
        'Cumulative Make-Up Owed': row['Cumulative Make-Up Owed'],
        'End Value': row['End Value']
    }));

    const totalPaymentsToGrantor = projection_data.reduce((sum, row) => sum + row['Actual Payment Made'], 0);
    const remainderToCharity = projection_data.length > 0 ? projection_data[projection_data.length - 1]['End Value'] : 0;
    const upfrontTaxSavings = upfrontTaxSavingsFromDAF + upfrontTaxSavingsFromCRUT;
    const totalBenefit = totalPaymentsToGrantor + totalStateTaxSaved - oneTimeNiitPaid + upfrontTaxSavings + avoidedCapitalGainsOnDAF;

    const outrightSaleGain = Math.max(0, initialContribution - assetBasis);
    const outrightSaleNiit = includeNIIT
        ? calculateSimplifiedNiit({ gainAmount: outrightSaleGain, grantorAGI, niitThreshold, niitRate })
        : { taxableGain: 0, tax: 0 };
    const outrightSaleNetProceeds = initialContribution - (outrightSaleGain * capitalGainsTaxRateDec) - outrightSaleNiit.tax;
    const benchmarkGrowthRateDec = Math.max(0, postFlipIncomeYieldDec + postFlipCapAppreciationDec - clientManagementFeeDec);
    const outrightSaleFutureValue = outrightSaleNetProceeds * Math.pow(1 + benchmarkGrowthRateDec, trustTerm);
    const netBenefitVsOutrightSale = totalBenefit - outrightSaleFutureValue;

    const summary_report = {
        'Total Benefit of Strategy': totalBenefit,
        'Total Payments to Grantor': totalPaymentsToGrantor,
        'Projected Remainder to Charity': remainderToCharity,
        'Total Upfront Tax Savings': upfrontTaxSavings,
        'Avoided Cap. Gains (DAF)': avoidedCapitalGainsOnDAF,
        'Total State Tax Saved (NING)': totalStateTaxSaved,
        'Effective State Tax Savings Rate': effectiveStateTaxRateDec * 100,
        'One-Time NIIT Paid (Trust)': oneTimeNiitPaid,
        'Total Client Fees Paid': cumulativeClientFees,
        'Initial DAF Deduction': dafTaxDeduction,
        'Initial CRUT Deduction': crutTaxDeduction,
        'Calculated Trust Term': trustTerm,
        'DAF Deduction Used': dafDeductionUsed,
        'DAF Deduction Carried Forward': dafDeductionCarriedForward,
        'CRUT Deduction Used': crutDeductionUsed,
        'CRUT Deduction Carried Forward': crutDeductionCarriedForward,
        'Outright Sale Net Proceeds': outrightSaleNetProceeds,
        'Outright Sale Future Value': outrightSaleFutureValue,
        'Net Benefit vs Outright Sale': netBenefitVsOutrightSale
    };

    const audit = {
        'Initial Contribution to CRUT': initialContributionForCRUT,
        'DAF Donation Value': dafDonationValue,
        'Flip Treatment Mode': flipTreatmentMode,
        'Basis Allocated to CRUT': basisForCRUT,
        'Section 7520 Source': inputs.section7520RateMode,
        'Section 7520 Selection': section7520SelectionLabel,
        'Section 7520 Revenue Ruling': selectedSection7520Preset.revenueRuling,
        'Section 7520 Rate Applied': appliedSection7520Rate,
        'Adjusted Payout Rate': adjustedPayoutRate,
        'Charitable Remainder Factor': charitableRemainderFactor,
        'Present Value of Remainder': presentValueOfRemainder,
        'Payout Frequency Factor': payoutFrequencyFactor,
        'Management Fee Applied': clientManagementFeeDec,
        'Pre-Flip Income Yield Applied': preFlipIncomeYieldDec,
        'Unitrust Valuation Basis': 'Beginning-of-year fair market value',
        'Outright Sale NIIT Taxable Gain': outrightSaleNiit.taxableGain,
        'Validation Warnings': validation.warnings.length
    };

    const disclosures = buildDisclosures({
        termType,
        payoutSchedule,
        useNingTrust,
        includeNIIT,
        additionalContributionAmount
    });

    return { projection_data, annual_ledger, summary_report, audit, disclosures, inputs, validation };
}
