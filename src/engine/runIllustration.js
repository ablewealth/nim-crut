import { normalizeInputs } from '../config/inputs.js';
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
    const ages = Object.keys(LIFE_EXPECTANCY_TABLE).map(Number);
    const closestAge = ages.reduce((previous, current) => (
        Math.abs(current - grantorAge) < Math.abs(previous - grantorAge) ? current : previous
    ));

    return LIFE_EXPECTANCY_TABLE[closestAge];
}

function calculateCharitableRemainderFactor(age, term, adjustedPayoutRate, rate7520) {
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

export function runIllustration(rawInputs = {}) {
    const inputs = normalizeInputs(rawInputs);
    const validation = validateInputs(inputs);

    if (validation.errors.length > 0) {
        return createValidationResponse(inputs, validation);
    }

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
        payoutSchedule,
        section_7520_rate,
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

    if (flipTriggerYear > trustTerm) {
        return createValidationResponse(inputs, {
            errors: ['Flip trigger year cannot exceed the calculated trust term.'],
            warnings: validation.warnings
        });
    }

    const payoutRateDec = payoutRate / 100;
    const preFlipIncomeYieldDec = preFlipIncomeYield / 100;
    const preFlipGrowthRateDec = preFlipGrowthRate / 100;
    const postFlipIncomeYieldDec = postFlipIncomeYield / 100;
    const postFlipCapAppreciationDec = postFlipCapAppreciation / 100;
    const section7520RateDec = section_7520_rate / 100;
    const grantorOrdinaryTaxRateDec = grantorOrdinaryTaxRate / 100;
    const capitalGainsTaxRateDec = capitalGainsTaxRate / 100;
    const residenceStateTaxRateDec = residenceStateTaxRate / 100;
    const ningStateTaxRateDec = ningStateTaxRate / 100;
    const effectiveStateTaxRateDec = Math.max(0, residenceStateTaxRateDec - ningStateTaxRateDec);
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
    const charitableRemainderFactor = calculateCharitableRemainderFactor(
        grantorAge,
        trustTerm,
        adjustedPayoutRate,
        section7520RateDec
    );
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

    const totalGainInCRUT = Math.max(0, initialContributionForCRUT - basisForCRUT);
    const trustNiit = (useNingTrust && includeNIIT)
        ? calculateSimplifiedNiit({ gainAmount: totalGainInCRUT, grantorAGI, niitThreshold, niitRate })
        : { taxableGain: 0, tax: 0 };
    const oneTimeNiitPaid = trustNiit.tax;

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
        const phase = year < flipTriggerYear
            ? 'Pre-Flip NIMCRUT'
            : year === flipTriggerYear
                ? 'Flip Year'
                : 'Post-Flip CRUT';

        let incomeGenerated;
        let appreciation;
        if (year < flipTriggerYear) {
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
        if (year < flipTriggerYear) {
            makeupOwed += makeupOwedThisYear;
            actualPayment = incomeGenerated;
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
        'Basis Allocated to CRUT': basisForCRUT,
        'Adjusted Payout Rate': adjustedPayoutRate,
        'Charitable Remainder Factor': charitableRemainderFactor,
        'Present Value of Remainder': presentValueOfRemainder,
        'Payout Frequency Factor': payoutFrequencyFactor,
        'Management Fee Applied': clientManagementFeeDec,
        'Pre-Flip Income Yield Applied': preFlipIncomeYieldDec,
        'Trust NIIT Taxable Gain': trustNiit.taxableGain,
        'Outright Sale NIIT Taxable Gain': outrightSaleNiit.taxableGain,
        'Validation Warnings': validation.warnings.length
    };

    return { projection_data, annual_ledger, summary_report, audit, inputs, validation };
}
