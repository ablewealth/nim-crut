export function validateInputs(inputs) {
    const errors = [];
    const warnings = [];

    if (inputs.initialContribution <= 0) {
        errors.push('Initial contribution must be greater than zero.');
    }

    if (inputs.assetBasis < 0) {
        errors.push('Asset basis cannot be negative.');
    }

    if (inputs.assetBasis > inputs.initialContribution) {
        errors.push('Asset basis cannot exceed the total asset value.');
    }

    if (inputs.payoutRate < 5 || inputs.payoutRate > 50) {
        errors.push('Payout rate must be between 5% and 50%.');
    }

    if (inputs.termType === 'Term of Years' && (!Number.isInteger(inputs.trustTerm) || inputs.trustTerm < 1 || inputs.trustTerm > 40)) {
        errors.push('Term-of-years mode requires a trust term between 1 and 40 years.');
    }

    if (inputs.flipTriggerYear < 1) {
        errors.push('Flip trigger year must be at least 1.');
    }

    const effectiveTrustTerm = inputs.termType === 'Life Expectancy' ? null : inputs.trustTerm;
    if (effectiveTrustTerm !== null && inputs.flipTriggerYear > effectiveTrustTerm) {
        errors.push('Flip trigger year cannot exceed the trust term.');
    }

    if (inputs.additionalContributionAmount < 0) {
        errors.push('Additional contribution amount cannot be negative.');
    }

    if (inputs.additionalContributionAmount > 0 && effectiveTrustTerm !== null && inputs.additionalContributionYear > effectiveTrustTerm) {
        errors.push('Additional contribution year cannot exceed the trust term when a contribution amount is provided.');
    }

    if (inputs.useDAF) {
        if (inputs.dafContributionPercentage <= 0 || inputs.dafContributionPercentage >= 100) {
            errors.push('DAF contribution percentage must be greater than 0% and less than 100%.');
        }

        const remainingContribution = inputs.initialContribution * (1 - (inputs.dafContributionPercentage / 100));
        if (remainingContribution <= 0) {
            errors.push('DAF contribution leaves no value available for the CRUT.');
        }
    }

    if (inputs.section_7520_rate <= 0) {
        errors.push('Section 7520 rate must be greater than zero.');
    }

    if (inputs.useNingTrust && inputs.ningStateTaxRate > 0) {
        warnings.push('NING State Tax Rate is captured but not yet used in the current state-tax savings formula.');
    }

    if (inputs.useNingTrust && inputs.includeNIIT && inputs.niitThreshold !== 250000) {
        warnings.push('NIIT MAGI Threshold is captured for future work but is not yet used in the current NIIT estimate.');
    }

    if (inputs.termType === 'Life Expectancy') {
        warnings.push('Life expectancy mode still uses the existing coarse lookup table in this tranche; actuarial table integration is planned for a later tranche.');
    }

    return { errors, warnings };
}
