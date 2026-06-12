#pragma once

#include "CoreMinimal.h"
#include "Characters/AV_EnemyBase.h"
#include "AV_AshboundSoldier.generated.h"

/**
 * Ashbound Soldier — a forgotten soldier still following old military patterns,
 * no longer remembering who he served. The first enemy the player meets.
 *
 * Tuned as a teacher: slow telegraphed 2-hit combo, low poise (staggerable),
 * generous punish windows. All values are editable defaults; visuals (broken
 * armor, ash leaking from the helmet) are set up in the Blueprint child.
 */
UCLASS()
class ASHENVOW_API AAV_AshboundSoldier : public AAV_EnemyBase
{
	GENERATED_BODY()

public:
	AAV_AshboundSoldier();
};
