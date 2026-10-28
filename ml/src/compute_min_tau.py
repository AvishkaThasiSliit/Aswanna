import sys
from pathlib import Path
repo_root = Path(__file__).resolve().parents[2]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import numpy as np
from ml.src.simulator.generator import DailySpendSimulator, CATEGORIES
from ml.src.models.shrinkage_prior import ShrinkagePriorForecaster
from ml.src.evaluate import load_prior_curves, KNOTS, EVAL_TAUS

prior_curves = load_prior_curves(Path('ml/artifacts/phasing_priors_v0.json'), crop='Paddy')
ns = [5, 10, 30, 100, 300]
results = {'S1': {n: {t: [] for t in EVAL_TAUS} for n in ns}, 'S2': {n: {t: [] for t in EVAL_TAUS} for n in ns}}

kappas = {
    'S1': {5: 0.0, 10: 0.0, 30: 0.0, 100: 0.0, 300: 0.0},
    'S2': {5: 0.0, 10: 0.0, 30: 1.0, 100: 5.0, 300: 20.0}
}

for seed in range(1, 31):
    sim_tr = DailySpendSimulator(seed=1000 + seed)
    sim_te = DailySpendSimulator(seed=4000 + seed)
    for sc in ['S1', 'S2']:
        tr = sim_tr.generate_cohort(300, season='Maha', year=2022, prefix=f'tr_{sc}_{seed}', scenario=sc)
        te = sim_te.generate_cohort(100, season='Maha', year=2024, prefix=f'te_{sc}_{seed}', scenario=sc)
        for n in ns:
            k = kappas[sc][n]
            if k == 0.0:
                m = ShrinkagePriorForecaster(prior_curves=prior_curves, empirical_only=True).fit(tr[:n])
            else:
                m = ShrinkagePriorForecaster(prior_curves=prior_curves, k_shrinkage=k).fit(tr[:n])
            for t in EVAL_TAUS:
                apes = []
                for cyc in te:
                    d = max(1, int(round(t * cyc['cycle_length_days'])))
                    pred = m.forecast(cyc, d, cyc['so1_baseline_predicted'])
                    act = float(cyc['true_final_cost'])
                    apes.append(abs(act - pred['final_cost']) / act)
                results[sc][n][t].append(np.mean(apes))

print('=== RESULTS ===')
min_taus = {}
for n in ns:
    print(f'=== n = {n} ===')
    min_tau = None
    for t in EVAL_TAUS:
        m_s1 = np.mean(results['S1'][n][t])
        m_s2 = np.mean(results['S2'][n][t])
        status = 'PASS' if (m_s1 <= 0.15 and m_s2 <= 0.15) else 'FAIL'
        if status == 'PASS' and min_tau is None:
            min_tau = t
        print(f'tau={t:.2f} | S1: {m_s1*100:6.2f}% | S2: {m_s2*100:6.2f}% | {status}')
    min_taus[n] = min_tau
    print(f'Derived minTau(n={n}) = {min_tau}')

print('\nSummary of minTau by n:')
for n in ns:
    print(f'n={n}: minTau = {min_taus[n]}')
