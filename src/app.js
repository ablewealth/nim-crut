import { inputsConfig, normalizeInputs, tooltips } from './config/inputs.js';
import { runIllustration } from './engine/runIllustration.js';
import { formatters } from './shared/formatters.js';

let summaryChart = null;

const inputContainer = document.getElementById('input-container');
const summaryDetailsEl = document.getElementById('summary-details');
const auditDetailsEl = document.getElementById('audit-details');
const projectionHeadEl = document.getElementById('projection-head');
const projectionBodyEl = document.getElementById('projection-body');
const errorMessageEl = document.getElementById('error-message');
const warningMessageEl = document.getElementById('warning-message');

function getSectionTitle(section) {
    const sectionTitles = {
        Strategy: '🎯 Strategy Configuration',
        Asset: '💰 Asset & Contributions',
        Trust: '🏛️ Trust Structure',
        Performance: '📈 Investment Performance',
        Tax: '📊 Tax Rates'
    };

    return sectionTitles[section] || section;
}

function createInputs() {
    let currentSection = '';

    inputsConfig.forEach((config) => {
        if (config.section && config.section !== currentSection) {
            currentSection = config.section;

            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'mt-6 mb-3 first:mt-0';
            sectionHeader.innerHTML = `
                <h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">
                    ${getSectionTitle(config.section)}
                </h3>
            `;
            inputContainer.appendChild(sectionHeader);
        }

        const group = document.createElement('div');
        group.id = `group-${config.id}`;
        group.className = 'mb-4';

        if (config.dependsOn) {
            group.classList.add('pl-4', 'border-l-2', 'border-indigo-100', 'ml-2');
        }

        if (config.type === 'toggle') {
            group.className = 'flex items-center justify-between pt-2';
            const label = document.createElement('span');
            label.className = 'text-xs font-medium text-gray-700';
            label.innerHTML = `${config.label} <span class="info-icon" title="${tooltips[config.id] || ''}">&#9432;</span>`;
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = config.id;
            checkbox.checked = config.value;
            checkbox.className = 'toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer';
            checkbox.addEventListener('change', updateModel);
            const labelForCheckbox = document.createElement('label');
            labelForCheckbox.htmlFor = config.id;
            labelForCheckbox.className = 'toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer';
            toggleContainer.appendChild(checkbox);
            toggleContainer.appendChild(labelForCheckbox);
            group.appendChild(label);
            group.appendChild(toggleContainer);
        } else {
            const label = document.createElement('label');
            label.htmlFor = config.id;
            label.className = 'block text-xs font-medium text-gray-700 mb-1';

            const labelText = document.createElement('span');
            labelText.textContent = config.label;
            label.appendChild(labelText);
            label.innerHTML += `<span class="info-icon" title="${tooltips[config.id] || ''}">&#9432;</span>`;

            const valueSpan = document.createElement('span');
            valueSpan.id = `${config.id}-value`;
            valueSpan.className = 'float-right font-semibold text-indigo-800 text-xs';
            label.appendChild(valueSpan);
            group.appendChild(label);

            if (config.type === 'select') {
                const select = document.createElement('select');
                select.id = config.id;
                select.className = 'w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs';
                config.options.forEach((optionValue) => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    option.selected = optionValue === config.value;
                    select.appendChild(option);
                });
                select.addEventListener('change', updateModel);
                group.appendChild(select);
            } else if (config.type === 'slider') {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.id = config.id;
                slider.min = config.min;
                slider.max = config.max;
                slider.step = config.step;
                slider.value = config.value;
                slider.className = 'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-track';
                slider.addEventListener('input', updateModel);
                group.appendChild(slider);
            } else {
                const input = document.createElement('input');
                input.type = 'number';
                input.id = config.id;
                input.value = config.value;
                input.className = 'w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs';
                input.addEventListener('input', updateModel);
                group.appendChild(input);
            }
        }

        inputContainer.appendChild(group);
    });
}

function getCurrentInputs() {
    const inputs = {};

    inputsConfig.forEach((config) => {
        const element = document.getElementById(config.id);
        if (!element) {
            return;
        }

        if (config.type === 'toggle') {
            inputs[config.id] = element.checked;
        } else if (config.type === 'number' || config.type === 'slider') {
            inputs[config.id] = Number.parseFloat(element.value);
        } else {
            inputs[config.id] = element.value;
        }
    });

    return normalizeInputs(inputs);
}

function updateConditionalFields() {
    inputsConfig.forEach((config) => {
        if (!config.dependsOn) {
            return;
        }

        const group = document.getElementById(`group-${config.id}`);
        const controller = document.getElementById(config.dependsOn);
        let shouldShow = false;

        if (controller.type === 'checkbox') {
            shouldShow = controller.checked;
        } else if (controller.type === 'select-one') {
            shouldShow = controller.value === config.dependsOnValue;
        }

        group.classList.toggle('hidden', !shouldShow);
    });
}


function renderWarnings(warnings = []) {
    if (!warningMessageEl) {
        return;
    }

    if (warnings.length === 0) {
        warningMessageEl.innerHTML = '';
        warningMessageEl.classList.add('hidden');
        return;
    }

    warningMessageEl.innerHTML = `
        <div class="font-semibold mb-2">Assumption warnings</div>
        <ul class="list-disc pl-5 space-y-1 text-sm">
            ${warnings.map((warning) => `<li>${warning}</li>`).join('')}
        </ul>
    `;
    warningMessageEl.classList.remove('hidden');
}

function updateDisplayedValues(currentInputs) {
    inputsConfig.forEach((config) => {
        const valueSpan = document.getElementById(`${config.id}-value`);
        const element = document.getElementById(config.id);

        if (!valueSpan || !element || config.type === 'toggle' || config.type === 'select') {
            return;
        }

        if (config.format === 'percent') {
            valueSpan.textContent = `${Number.parseFloat(element.value).toFixed(2)}%`;
        } else {
            valueSpan.textContent = formatters[config.format](currentInputs[config.id]);
        }
    });
}


function renderAuditDetails(audit) {
    if (!auditDetailsEl || !audit) {
        return;
    }

    const entries = [
        ['Initial Contribution to CRUT', formatters.currency(audit['Initial Contribution to CRUT'])],
        ['DAF Donation Value', formatters.currency(audit['DAF Donation Value'])],
        ['Flip Treatment Mode', audit['Flip Treatment Mode']],
        ['Section 7520 Source', audit['Section 7520 Source']],
        ['Section 7520 Selection', audit['Section 7520 Selection']],
        ['Section 7520 Rate Applied', formatters.percent(audit['Section 7520 Rate Applied'])],
        ['Adjusted Payout Rate', formatters.percent(audit['Adjusted Payout Rate'] * 100)],
        ['Charitable Remainder Factor', formatters.percent(audit['Charitable Remainder Factor'] * 100)],
        ['Present Value of Remainder', formatters.currency(audit['Present Value of Remainder'])],
        ['Pre-Flip Income Yield Applied', formatters.percent(audit['Pre-Flip Income Yield Applied'] * 100)],
        ['Trust NIIT Taxable Gain', formatters.currency(audit['Trust NIIT Taxable Gain'])],
        ['Outright Sale NIIT Taxable Gain', formatters.currency(audit['Outright Sale NIIT Taxable Gain'])]
    ];

    auditDetailsEl.innerHTML = `
        <div class="font-semibold text-gray-700">Methodology & audit snapshot</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            ${entries.map(([label, value]) => `
                <div class="flex justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span>${label}</span>
                    <span class="font-medium text-gray-800">${value}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSummary(summary, inputs) {
    const chartData = {
        labels: ['Payments to Grantor', 'Remainder to Charity', 'Total Tax Savings'],
        datasets: [{
            data: [
                summary['Total Payments to Grantor'],
                summary['Projected Remainder to Charity'],
                summary['Total Upfront Tax Savings'] + summary['Total State Tax Saved (NING)'] + summary['Avoided Cap. Gains (DAF)']
            ],
            backgroundColor: ['#303f9f', '#ffc107', '#7e57c2'],
            hoverBackgroundColor: ['#1a237e', '#ffa000', '#5e35b1'],
            borderColor: '#fff',
            borderWidth: 2
        }]
    };

    const ctx = document.getElementById('summaryChart').getContext('2d');
    if (summaryChart) {
        summaryChart.destroy();
    }

    summaryChart = new window.Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 10 } },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label || ''}: ${formatters.currency(context.parsed)}`
                    }
                }
            }
        }
    });

    const termDisplay = inputs.termType === 'Life Expectancy'
        ? `Life Expectancy (${summary['Calculated Trust Term']} Yrs)`
        : `${summary['Calculated Trust Term']} Years`;

    summaryDetailsEl.innerHTML = `
        <div class="flex justify-between items-center bg-green-50 p-3 rounded-lg">
            <span class="font-medium text-gray-700 text-sm">Total Benefit of Strategy</span>
            <span class="font-bold text-lg text-green-700">${formatters.currency(summary['Total Benefit of Strategy'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Trust Term</span>
            <span class="font-semibold text-sm text-gray-800">${termDisplay}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Total Payments to Grantor</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['Total Payments to Grantor'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Total Client Fees Paid</span>
            <span class="font-semibold text-sm text-red-600">${formatters.currency(summary['Total Client Fees Paid'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Remainder to Charity</span>
            <span class="font-semibold text-sm text-yellow-600">${formatters.currency(summary['Projected Remainder to Charity'])}</span>
        </div>
        <div class="flex justify-between items-center bg-purple-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Total Upfront Tax Savings</span>
            <span class="font-semibold text-sm text-purple-600">${formatters.currency(summary['Total Upfront Tax Savings'])}</span>
        </div>
         ${inputs.useDAF ? `
         <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">Avoided Cap. Gains (DAF)</span>
            <span class="font-semibold text-sm text-green-600">${formatters.currency(summary['Avoided Cap. Gains (DAF)'])}</span>
        </div>` : ''}
        ${(inputs.useDAF && inputs.applyAGILimitation) ? `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">DAF Deduction Used (30% AGI)</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['DAF Deduction Used'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">DAF Deduction Carryforward</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['DAF Deduction Carried Forward'])}</span>
        </div>` : ''}
        ${(inputs.applyCRUTAGILimitation) ? `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">CRUT Deduction Used (30% AGI)</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['CRUT Deduction Used'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">CRUT Deduction Carryforward</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['CRUT Deduction Carried Forward'])}</span>
        </div>` : ''}
        ${inputs.useNingTrust ? `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">Total State Tax Saved (NING)</span>
            <span class="font-semibold text-sm text-blue-600">${formatters.currency(summary['Total State Tax Saved (NING)'])}</span>
        </div>
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">Effective State Tax Savings Rate</span>
            <span class="font-semibold text-sm text-blue-600">${formatters.percent(summary['Effective State Tax Savings Rate'])}</span>
        </div>
        <div class="flex justify-between items-center bg-red-50 p-2 rounded-lg ml-4 border-l-2">
            <span class="font-medium text-gray-500 text-xs">One-Time NIIT Paid</span>
            <span class="font-semibold text-sm text-red-600">${formatters.currency(summary['One-Time NIIT Paid (Trust)'])}</span>
        </div>` : ''}
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Outright Sale Future Value</span>
            <span class="font-semibold text-sm text-gray-800">${formatters.currency(summary['Outright Sale Future Value'])}</span>
        </div>
        <div class="flex justify-between items-center bg-indigo-50 p-2 rounded-lg">
            <span class="font-medium text-gray-600 text-xs">Net Benefit vs Outright Sale</span>
            <span class="font-semibold text-sm text-indigo-700">${formatters.currency(summary['Net Benefit vs Outright Sale'])}</span>
        </div>
    `;
}

function renderProjection(data, currentInputs) {
    if (!data || data.length === 0) {
        return;
    }

    projectionHeadEl.innerHTML = '';
    const headerRow = document.createElement('tr');
    Object.keys(data[0]).forEach((key) => {
        if (!currentInputs.useNingTrust && key === 'State Tax Saved') {
            return;
        }

        const th = document.createElement('th');
        th.className = 'header-cell';
        th.title = tooltips[key] || '';
        th.textContent = key.replace(/_/g, ' ');
        headerRow.appendChild(th);
    });
    projectionHeadEl.appendChild(headerRow);

    projectionBodyEl.innerHTML = '';
    data.forEach((row, index) => {
        const tr = document.createElement('tr');

        if (row.Year === currentInputs.flipTriggerYear) {
            tr.className = 'bg-yellow-100 font-semibold';
        } else if (index === data.length - 1) {
            tr.className = 'bg-blue-100 font-semibold';
        } else if (index % 2 === 0) {
            tr.className = 'bg-white';
        } else {
            tr.className = 'bg-gray-50/50';
        }

        if (row.Year === currentInputs.additionalContributionYear) {
            tr.classList.add('border-t-2', 'border-blue-300');
        }

        Object.entries(row).forEach(([key, value]) => {
            if (!currentInputs.useNingTrust && key === 'State Tax Saved') {
                return;
            }

            const td = document.createElement('td');
            td.className = 'table-cell';
            if (typeof value === 'string') {
                td.textContent = value;
            } else if (key.includes('Year') || key.includes('Age')) {
                td.textContent = formatters.integer(value);
            } else {
                td.textContent = formatters.currency(value);
            }
            tr.appendChild(td);
        });

        projectionBodyEl.appendChild(tr);
    });
}

function updateModel() {
    const currentInputs = getCurrentInputs();
    updateDisplayedValues(currentInputs);
    updateConditionalFields();

    const result = runIllustration(currentInputs);

    if (result.error) {
        summaryDetailsEl.innerHTML = '';
        if (auditDetailsEl) { auditDetailsEl.innerHTML = ''; }
        if (summaryChart) {
            summaryChart.destroy();
        }
        projectionHeadEl.innerHTML = '';
        projectionBodyEl.innerHTML = '';
        warningMessageEl?.classList.add('hidden');
        errorMessageEl.textContent = result.error;
        errorMessageEl.classList.remove('hidden');
        return;
    }

    errorMessageEl.classList.add('hidden');
    renderWarnings(result.validation?.warnings || []);
    document.getElementById('flipTriggerYear').max = result.summary_report['Calculated Trust Term'];
    document.getElementById('additionalContributionYear').max = result.summary_report['Calculated Trust Term'];

    renderSummary(result.summary_report, result.inputs);
    renderAuditDetails(result.audit);
    renderProjection(result.projection_data, result.inputs);
}

function initializeExplanation() {
    const contentWrapper = document.querySelector('#explanation-content > div');
    const toggle = document.getElementById('explanation-toggle');
    const content = document.getElementById('explanation-content');
    const arrow = document.getElementById('explanation-arrow');

    contentWrapper.innerHTML = `
        <div class="explanation-card" style="border-color: #303f9f;">
            <div class="flex items-center mb-2">
                <svg class="w-6 h-6 mr-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2v-14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <h4 class="font-semibold text-lg text-gray-800">Core Strategy: The FLIP NIM-CRUT</h4>
            </div>
            <p class="text-xs text-gray-600 mb-3">A FLIP NIM-CRUT is a specialized trust designed to solve a specific problem: how to generate tax benefits and future income from a highly appreciated, non-income-producing asset (like private stock or real estate) without triggering a massive upfront tax bill.</p>
            <div class="space-y-2 text-xs">
                <p><b>Act I: The Growth Phase (Pre-Flip).</b> The illiquid asset is placed in the trust. Since it generates no cash, the trust pays no income. However, the unpaid amount is tracked in a "make-up" account. The key benefit here is that the asset grows in a <b>tax-exempt environment</b>, maximizing its potential before the sale.</p>
                <p><b>Act II: The Trigger Year.</b> In the designated trigger year, the model now keeps the trust under the pre-flip NIMCRUT rules by default. Income limits still apply during that year and any makeup balance is carried into the transition.</p>
                <p><b>Act III: The First Post-Flip Year.</b> Beginning in the following year, the trust converts to standard CRUT treatment. In Spec Mode, any remaining make-up balance is forfeited at that transition point before the standard unitrust payment stream begins.</p>
            </div>
        </div>

        <div class="explanation-card" style="border-color: #7e57c2;">
             <div class="flex items-center mb-2">
                <svg class="w-6 h-6 mr-3 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path></svg>
                <h4 class="font-semibold text-lg text-gray-800">Strategy Layer 1: Donor-Advised Fund (DAF)</h4>
            </div>
            <p class="text-xs text-gray-600">This is a powerful "front-end" strategy. By donating a portion of your asset to a DAF *before* the sale, you achieve two significant benefits: <b>(1)</b> The donated portion is removed from your ownership, so you completely and permanently <b>avoid capital gains tax</b> on its appreciation. <b>(2)</b> You receive an immediate <b>income tax deduction</b> for the full fair market value of the donation, which can be used to offset other income (subject to AGI limits).</p>
        </div>

        <div class="explanation-card" style="border-color: #1e88e5;">
             <div class="flex items-center mb-2">
                <svg class="w-6 h-6 mr-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <h4 class="font-semibold text-lg text-gray-800">Strategy Layer 2: NING Trust</h4>
            </div>
            <p class="text-xs text-gray-600">This is a sophisticated state tax arbitrage strategy. For clients in high-tax states like California or New Jersey, a NING Trust can be established in a zero-tax state like Nevada. By routing the CRUT income payments through the NING trust, you can potentially <b>eliminate state income tax</b> on those distributions. This model also includes a critical toggle for the <b>3.8% Net Investment Income Tax (NIIT)</b>. While the sale of an active business is often exempt, a sale within a trust structure might trigger this tax, making it a crucial variable that requires professional analysis.</p>
        </div>
    `;

    toggle.addEventListener('click', () => {
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
            arrow.style.transform = 'rotate(0deg)';
        } else {
            content.style.maxHeight = `${content.scrollHeight}px`;
            arrow.style.transform = 'rotate(180deg)';
        }
    });
}

function generatePrintReport() {
    try {
        const printDateEl = document.getElementById('print-date');
        if (printDateEl) {
            printDateEl.textContent = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        requestAnimationFrame(() => {
            setTimeout(() => {
                window.focus();
                window.print();
            }, 75);
        });
    } catch (error) {
        console.error('Print failed:', error);
        window.alert('Unable to generate the print report. Please try again.');
    }
}

window.generatePrintReport = generatePrintReport;
window.getCurrentInputs = getCurrentInputs;

document.addEventListener('DOMContentLoaded', () => {
    createInputs();
    initializeExplanation();
    updateModel();
});
