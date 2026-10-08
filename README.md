# Aswenna Monorepo

## Overview
This is the data contract and backend services phase for the Aswenna project.

## Project Structure
- `/client`: Client application placeholder
- `/server`: Backend services and API (Mongoose models, Services)
- `/shared`: Shared JS modules (form schemas, validation, units) between client and server

## How to Run

1. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Run Tests**
   \`\`\`bash
   npm run test
   \`\`\`

3. **Seed Database**
   Ensure MongoDB is running locally on \`mongodb://localhost:27017/aswenna\`.
   \`\`\`bash
   npm run seed
   \`\`\`

4. **Import Activity Codes**
   \`\`\`bash
   npm run import:activities -- ./path-to-file.csv
   \`\`\`

## Assumptions to Confirm with DoA

- **CONFIRM WITH DoA:** `labour.cost = (familyLabour + hiredLabour) x dailyWage`. It is unknown whether the family/hired columns are persons, days, or person-days, and whether family labour is priced.
- **CONFIRM WITH DoA:** `machinery.cost` is entered directly; `unitPrice` is stored but not multiplied unless `quantity` is present.
- **CONFIRM WITH DoA:** `inputType` enum is a PLACEHOLDER (seed, fertilizer, agrochemical, other).
- **CONFIRM WITH DoA:** `tenure` values for `Land` enum (`freehold`, `ande`, `bhaddha`, `kuli`, `state`, `private`) map exactly to the paper.

## TODOs
- **Unread Handwritten Annotation**: There is a handwritten annotation beside the "MachineryOwned" (කෘෂි යන්ත්‍රෝපකරණ පිළිබඳව තොරතුරු) heading on the DoA paper that is still unread. An `annotationNote` nullable field has been added to the model to support it later once deciphered.
