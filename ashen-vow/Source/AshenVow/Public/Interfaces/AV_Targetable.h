#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "AV_Targetable.generated.h"

UINTERFACE(MinimalAPI, BlueprintType)
class UAV_Targetable : public UInterface
{
	GENERATED_BODY()
};

/** Implemented by anything the lock-on system can target (enemies, bosses). */
class ASHENVOW_API IAV_Targetable
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "AshenVow|Targeting")
	bool IsTargetable();

	/** World-space point the camera should focus on (usually chest height). */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "AshenVow|Targeting")
	FVector GetTargetPoint();
};
