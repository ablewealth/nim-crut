// Improved print functionality for the wealth planning calculator

// Replace the existing generatePrintAssumptions function with this improved version
function generatePrintAssumptions() {
    const printAssumptionsEl = document.getElementById('print-assumptions-content');
    const currentInputs = getCurrentInputs();

    const sections = {
        'Strategy': [
            { label: 'DAF Pre-Sale', value: currentInputs.useDAF ? 'Yes' : 'No' },
            { label: 'DAF %', value: currentInputs.useDAF ? `${currentInputs.dafContributionPercentage}%` : 'N/A' },
            { label: 'NING Trust', value: currentInputs.useNingTrust ? 'Yes' : 'No' },
            { label: 'Include NIIT', value: (currentInputs.useNingTrust && currentInputs.includeNIIT) ? 'Yes' : 'No' }
        ],
        'Asset Details': [
            { label: 'Asset Value', value: `$${formatters.currency(currentInputs.initialContribution)}` },
            { label: 'Asset Basis', value: `$${formatters.currency(currentInputs.assetBasis)}` },
            { label: 'Grantor Age', value: `${currentInputs.grantorAge}` },
            { label: 'Trust Term', value: currentInputs.termType === 'Life Expectancy' ? 'Life Exp.' : `${currentInputs.trustTerm} yrs` },
            { label: 'Payout Rate', value: `${currentInputs.payoutRate}%` },
            { label: 'Flip Year', value: `${currentInputs.flipTriggerYear}` }
        ],
        'Growth Rates': [
            { label: 'Pre-Flip Growth', value: `${currentInputs.preFlipGrowthRate}%` },
            { label: 'Post-Flip Income', value: `${currentInputs.postFlipIncomeYield}%` },
            { label: 'Post-Flip Growth', value: `${currentInputs.postFlipCapAppreciation}%` },
            { label: 'Management Fee', value: `${currentInputs.clientManagementFee}%` }
        ],
        'Tax Rates': [
            { label: 'Ordinary Tax', value: `${currentInputs.grantorOrdinaryTaxRate}%` },
            { label: 'Capital Gains', value: `${currentInputs.capitalGainsTaxRate}%` },
            { label: 'Section 7520', value: `${currentInputs.section_7520_rate}%` },
            { label: 'State Tax', value: currentInputs.useNingTrust ? `${currentInputs.residenceStateTaxRate}%` : 'N/A' }
        ]
    };

    let html = '';
    Object.entries(sections).forEach(([sectionName, items]) => {
        html += `<div class="assumption-section">`;
        html += `<h4>${sectionName}</h4>`;
        items.forEach(item => {
            html += `<div class="assumption-item">`;
            html += `<span class="assumption-label">${item.label}:</span>`;
            html += `<span class="assumption-value">${item.value}</span>`;
            html += `</div>`;
        });
        html += `</div>`;
    });

    printAssumptionsEl.innerHTML = html;
}