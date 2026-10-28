# Aswanna System Usability Scale (SUS) Questionnaire Template

This document provides the standardized **System Usability Scale (SUS)** survey instrument and scoring methodology for evaluating the Aswanna Farm Accounting & Decision Support System with Department of Agriculture (DoA) extension officers and farmers.

---

## 1. Survey Administration Guidelines

- **Target Participants**: Agricultural Extension Officers (ගොවිජන සංවර්ධන නිලධාරීන්), Agrarian Service Center officers, and pilot smallholder farmers.
- **Timing**: Administered immediately following hands-on task completion (e.g., logging seasonal expenses, reviewing variance alerts, and checking crop recommendations).
- **Format**: 5-point Likert Scale (1 = Strongly Disagree / දැඩි ලෙස එකඟ නොවෙමි, 5 = Strongly Agree / දැඩි ලෙස එකඟ වෙමි).
- **Neutrality**: Instruct respondents to record their immediate impression without over-analyzing each item.

---

## 2. Standard 10-Item SUS Questionnaire

| # | Questionnaire Item (English / සිංහල) | Strongly Disagree (1) | Disagree (2) | Neutral (3) | Agree (4) | Strongly Agree (5) |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Q1** | I think that I would like to use this system frequently.<br>*(මම මෙම පද්ධතිය නිතර භාවිත කිරීමට කැමැත්තෙමි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q2** | I found the system unnecessarily complex.<br>*(මෙම පද්ධතිය අනවශ්‍ය ලෙස සංකීර්ණ බව මට හැඟේ.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q3** | I thought the system was easy to use.<br>*(මෙම පද්ධතිය භාවිත කිරීමට පහසු බව මට හැඟුණි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q4** | I think that I would need the support of a technical person to be able to use this system.<br>*(මෙම පද්ධතිය භාවිත කිරීමට මට තාක්ෂණික සහායකයෙකුගේ උපකාරය අවශ්‍ය වනු ඇතැයි සිතමි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q5** | I found the various functions in this system were well integrated.<br>*(මෙම පද්ධතියේ විවිධ කාර්යයන් මනාව ඒකාබද්ධ වී ඇති බව මට පෙනී ගියේය.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q6** | I thought there was too much inconsistency in this system.<br>*(මෙම පද්ධතිය තුළ අනවශ්‍ය නොගැලපීම් හෝ විසංවාද පවතින බව මට හැඟුණි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q7** | I would imagine that most people would learn to use this system very quickly.<br>*(බොහෝ දෙනෙකුට ඉතා ඉක්මනින් මෙම පද්ධතිය භාවිත කිරීමට ඉගෙන ගත හැකි වනු ඇතැයි සිතමි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q8** | I found the system very cumbersome to use.<br>*(මෙම පද්ධතිය භාවිතය ඉතා කරදරකාරී හෝ අසීරු බව මට පෙනුණි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q9** | I felt very confident using the system.<br>*(පද්ධතිය භාවිත කිරීමේදී මට ඉහළ විශ්වාසයක් සහ පහසුවක් දැනුණි.)* | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Q10** | I needed to learn a lot of things before I could get going with this system.<br>*(මෙම පද්ධතිය සමඟ වැඩ ආරම්භ කිරීමට පෙර මට බොහෝ දේ ඉගෙන ගැනීමට සිදු විය.)* | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## 3. Official SUS Scoring Methodology

The System Usability Scale yields a single composite score between **0 and 100** (Brooke, 1996). Individual item ratings (1 to 5) are transformed as follows:

### Step 1: Calculate Item Score Contributions
- For **Odd-Numbered Items** (Positive: Q1, Q3, Q5, Q7, Q9):
  $$\text{Contribution}_i = \text{Response}_i - 1$$
- For **Even-Numbered Items** (Negative: Q2, Q4, Q6, Q8, Q10):
  $$\text{Contribution}_i = 5 - \text{Response}_i$$

*Each item yields a normalized score contribution from 0 to 4.*

### Step 2: Sum and Scale
Sum the contributions across all 10 items and multiply by **2.5**:
$$\text{SUS Score} = 2.5 \times \sum_{i=1}^{10} \text{Contribution}_i$$

The resulting score ranges from **0 to 100**.

---

## 4. Benchmark Interpretation & Grade Scale

According to empirical research by Sauro & Lewis (2012, 2016) based on over 500 usability evaluations:

| SUS Score Range | Grade | Adjective Rating | Acceptability Range | Industry Percentile |
| :---: | :---: | :---: | :---: | :---: |
| **$\ge 80.3$** | **A** | Excellent | Acceptable | Top 10% (Score > 90 is A+) |
| **$74.0 - 80.2$** | **B** | Good | Acceptable | 70th – 89th percentile |
| **$68.0 - 73.9$** | **C** | OK / Average | Marginal | ~50th percentile (68 is average benchmark) |
| **$51.0 - 67.9$** | **D** | Poor | Marginal | 15th – 49th percentile |
| **$< 51.0$** | **F** | Awful | Not Acceptable | Bottom 15% |

### Success Target for Aswanna
- **Minimum Target**: $\text{SUS} \ge 70.0$ (Grade B-, firmly within Acceptable territory).
- **Target for Extension Officers**: $\text{SUS} \ge 80.0$ (Grade A, high adoption likelihood).
