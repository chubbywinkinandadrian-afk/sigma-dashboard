#include "Characters/AV_AshboundSoldier.h"
#include "Components/AV_HealthComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

AAV_AshboundSoldier::AAV_AshboundSoldier()
{
	// Slow tragic posture: unhurried patrol, committed swings.
	PatrolSpeed = 110.f;
	ChaseSpeed = 380.f;
	DetectRadius = 850.f;
	AttackRange = 170.f;
	AttackCooldownMin = 1.4f;
	AttackCooldownMax = 2.6f;
	ComboContinueChance = 0.7f;
	AshReward = 35;
	StaggerDuration = 0.9f; // low poise + long stagger = clear punish window
	HealthComponent->InitVitals(60.f, 30.f);

	// 2-hit combo: a readable horizontal cut, then a heavier follow-through.
	FAV_AttackData Slash1;
	Slash1.AttackName = FName("Soldier_Slash_1");
	Slash1.Damage = 12.f; Slash1.PoiseDamage = 15.f; Slash1.StaminaCost = 0.f;
	Slash1.StartupTime = 0.65f; Slash1.ActiveTime = 0.20f; Slash1.RecoveryTime = 0.80f;
	Slash1.Range = 130.f; Slash1.Radius = 60.f; Slash1.LungeImpulse = 200.f;

	FAV_AttackData Slash2 = Slash1;
	Slash2.AttackName = FName("Soldier_Slash_2");
	Slash2.Damage = 16.f; Slash2.PoiseDamage = 20.f;
	Slash2.StartupTime = 0.55f; Slash2.RecoveryTime = 1.0f; Slash2.LungeImpulse = 260.f;

	AttackCombo = { Slash1, Slash2 };
}
