#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Vow/AV_VowTypes.h"
#include "AV_VowDataAsset.generated.h"

/**
 * Editor-authored Vow. Create one per new Vow (DA_Vow_*) and add it to the
 * player's VowComponent "Extra Vow Assets" array — no code changes needed.
 * The three core Vows (Ash/Iron/Silence) are built into the component itself.
 */
UCLASS(BlueprintType)
class ASHENVOW_API UAV_VowDataAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AshenVow|Vow", meta = (ShowOnlyInnerProperties))
	FAV_VowDefinition Definition;
};
