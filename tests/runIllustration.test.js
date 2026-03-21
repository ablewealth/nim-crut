import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildDefaultInputs, normalizeInputs } from '../src/config/inputs.js';
import { runIllustration } from '../src/engine/runIllustration.js';

const EPSILON = 1e-6;

async function loadFixture(name) {
    const fixtureText = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
    return JSON.parse(fixtureText);
}

function assertApproxEqual(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: expected ${expected}, received ${actual}`);
}

test('buildDefaultInputs returns the configured defaults', () => {
    const defaults = buildDefaultInputs();

    assert.equal(defaults.initialContribution, 10000000);
    assert.equal(defaults.termType, 'Term of Years');
    assert.equal(defaults.useDAF, false);
    assert.equal(defaults.managementFeeRate, 0.5);
});

test('normalizeInputs coerces string values to typed engine inputs', () => {
    const normalized = normalizeInputs({
        useDAF: 'true',
        initialContribution: '12345',
        payoutRate: '7.5',
        termType: 'Life Expectancy'
    });

    assert.equal(normalized.useDAF, true);
    assert.equal(normalized.initialContribution, 12345);
    assert.equal(normalized.payoutRate, 7.5);
    assert.equal(normalized.termType, 'Life Expectancy');
});

test('default regression fixture matches the extracted engine output', async () => {
    const fixture = await loadFixture('default-scenario.json');
    const result = runIllustration(fixture.inputs);

    assert.equal(result.projection_data.length, fixture.expected.rowCount);
    assertApproxEqual(result.summary_report['Total Benefit of Strategy'], fixture.expected.summary['Total Benefit of Strategy'], 'default total benefit');
    assertApproxEqual(result.summary_report['Total Payments to Grantor'], fixture.expected.summary['Total Payments to Grantor'], 'default total payments');
    assertApproxEqual(result.summary_report['Projected Remainder to Charity'], fixture.expected.summary['Projected Remainder to Charity'], 'default remainder');
    assertApproxEqual(result.summary_report['Total Upfront Tax Savings'], fixture.expected.summary['Total Upfront Tax Savings'], 'default upfront tax savings');
    assertApproxEqual(result.summary_report['Initial CRUT Deduction'], fixture.expected.summary['Initial CRUT Deduction'], 'default CRUT deduction');
    assert.equal(result.summary_report['Calculated Trust Term'], fixture.expected.summary['Calculated Trust Term']);
    assertApproxEqual(result.projection_data[0]['Begin Value'], fixture.expected.firstYear['Begin Value'], 'default first-year begin value');
    assertApproxEqual(result.projection_data[0]['Actual Payment Made'], fixture.expected.firstYear['Actual Payment Made'], 'default first-year payment');
    assertApproxEqual(result.projection_data[0]['Cumulative Make-Up Owed'], fixture.expected.firstYear['Cumulative Make-Up Owed'], 'default first-year makeup');
    assertApproxEqual(result.projection_data[0]['End Value'], fixture.expected.firstYear['End Value'], 'default first-year end value');
    assertApproxEqual(result.projection_data[4]['Actual Payment Made'], fixture.expected.flipYear['Actual Payment Made'], 'default flip-year payment');
    assertApproxEqual(result.projection_data[4]['End Value'], fixture.expected.flipYear['End Value'], 'default flip-year end value');
});

test('advanced regression fixture matches life expectancy, DAF, NING, and fee outputs', async () => {
    const fixture = await loadFixture('advanced-scenario.json');
    const result = runIllustration(fixture.inputs);

    assert.equal(result.projection_data.length, fixture.expected.rowCount);
    for (const [key, expectedValue] of Object.entries(fixture.expected.summary)) {
        assertApproxEqual(result.summary_report[key], expectedValue, `advanced summary ${key}`);
    }
    assertApproxEqual(result.projection_data[0]['Begin Value'], fixture.expected.firstYear['Begin Value'], 'advanced first-year begin value');
    assertApproxEqual(result.projection_data[0]['Client Fee Paid'], fixture.expected.firstYear['Client Fee Paid'], 'advanced first-year fee');
    assertApproxEqual(result.projection_data[0]['End Value'], fixture.expected.firstYear['End Value'], 'advanced first-year end value');
    assertApproxEqual(result.projection_data[2]['Begin Value'], fixture.expected.thirdYear['Begin Value'], 'advanced third-year begin value');
    assertApproxEqual(result.projection_data[2]['Cumulative Make-Up Owed'], fixture.expected.thirdYear['Cumulative Make-Up Owed'], 'advanced third-year makeup');
});

test('life expectancy mode changes the calculated trust term', () => {
    const result = runIllustration({ termType: 'Life Expectancy', grantorAge: 70 });

    assert.equal(result.summary_report['Calculated Trust Term'], 15);
    assert.equal(result.projection_data.length, 15);
});

test('DAF AGI limitation reduces usable deduction and creates carryforward', () => {
    const result = runIllustration({
        useDAF: true,
        dafContributionPercentage: 20,
        grantorAGI: 500000,
        applyAGILimitation: true
    });

    assert.equal(result.summary_report['Initial DAF Deduction'], 2000000);
    assert.equal(result.summary_report['DAF Deduction Used'], 150000);
    assert.equal(result.summary_report['DAF Deduction Carried Forward'], 1850000);
});

test('NING plus NIIT adds both state-tax savings and NIIT cost', () => {
    const result = runIllustration({
        useNingTrust: true,
        includeNIIT: true,
        residenceStateTaxRate: 10
    });

    assert.ok(result.summary_report['Total State Tax Saved (NING)'] > 0);
    assert.equal(result.summary_report['One-Time NIIT Paid (Trust)'], 372400);
});

test('management fees accumulate when enabled', () => {
    const result = runIllustration({
        useManagementFee: true,
        managementFeeRate: 1,
        additionalContributionAmount: 500000,
        additionalContributionYear: 3
    });

    assert.ok(result.summary_report['Total Client Fees Paid'] > 0);
    assertApproxEqual(result.projection_data[2]['Begin Value'], 11931886.4, 'begin value reflects contribution before year 3 calculations');
});


test('invalid inputs return structured validation errors before projection', () => {
    const result = runIllustration({
        initialContribution: 1000000,
        assetBasis: 1500000
    });

    assert.match(result.error, /Asset basis cannot exceed the total asset value/);
    assert.deepEqual(result.validation.errors, ['Asset basis cannot exceed the total asset value.']);
    assert.equal(result.projection_data.length, 0);
});

test('NING state-tax savings use the residence-minus-NING differential', () => {
    const result = runIllustration({
        useNingTrust: true,
        residenceStateTaxRate: 10,
        ningStateTaxRate: 3
    });

    assertApproxEqual(result.summary_report['Effective State Tax Savings Rate'], 7, 'effective NING savings rate');
    assertApproxEqual(
        result.summary_report['Total State Tax Saved (NING)'],
        result.summary_report['Total Payments to Grantor'] * 0.07,
        'NING total state tax savings'
    );
});

test('NIIT threshold can reduce the trust NIIT estimate to zero', () => {
    const result = runIllustration({
        useNingTrust: true,
        includeNIIT: true,
        niitThreshold: 20000000
    });

    assert.equal(result.summary_report['One-Time NIIT Paid (Trust)'], 0);
});

test('summary report includes outright-sale benchmark outputs', () => {
    const result = runIllustration(buildDefaultInputs());

    assertApproxEqual(result.summary_report['Outright Sale Future Value'], 37474095.43654844, 'default outright-sale future value');
    assertApproxEqual(result.summary_report['Net Benefit vs Outright Sale'], -20833578.61484079, 'default net benefit versus outright sale');
});

test('annual ledger exposes tranche-two audit columns and phase labels', () => {
    const result = runIllustration(buildDefaultInputs());

    assert.equal(result.annual_ledger[0].Phase, 'Pre-Flip NIMCRUT');
    assert.equal(result.annual_ledger[4].Phase, 'Flip Year');
    assert.equal(result.annual_ledger[5].Phase, 'Post-Flip CRUT');
    assert.ok(Object.prototype.hasOwnProperty.call(result.annual_ledger[0], 'Income Generated'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.annual_ledger[0], 'Value Before Payment'));
    assert.ok(Object.prototype.hasOwnProperty.call(result.annual_ledger[0], 'Make-Up Paid This Year'));
});


test('pre-flip income yield generates pre-flip distributions and reduces makeup accrual', () => {
    const result = runIllustration({
        preFlipIncomeYield: 1,
        preFlipGrowthRate: 8
    });

    assertApproxEqual(result.projection_data[0]['Income Generated'], 100000, 'first-year pre-flip income');
    assertApproxEqual(result.projection_data[0]['Actual Payment Made'], 100000, 'first-year pre-flip payment');
    assertApproxEqual(result.projection_data[0]['Cumulative Make-Up Owed'], 650000, 'first-year reduced makeup balance');
});

test('audit output records the applied pre-flip income yield', () => {
    const result = runIllustration({ preFlipIncomeYield: 1.5 });

    assertApproxEqual(result.audit['Pre-Flip Income Yield Applied'], 0.015, 'audit pre-flip income yield');
});
