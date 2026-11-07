-- Nouvelle sorte de règle : masquer pendant un créneau, visible le reste du temps.
ALTER TYPE "RuleKind" ADD VALUE 'HIDE' BEFORE 'PROMO';
