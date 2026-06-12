#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AV_LockOnComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FAV_OnTargetLocked, AActor*, NewTarget);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FAV_OnTargetReleased);

/**
 * Lock-on targeting for the player. Scores nearby IAV_Targetable actors by distance
 * and angle from the camera, requires line of sight, rotates the controller toward
 * the target each tick, and auto-releases on death or excessive distance.
 * Target switching left/right is supported via SwitchTarget().
 */
UCLASS(ClassGroup = (AshenVow), meta = (BlueprintSpawnableComponent))
class ASHENVOW_API UAV_LockOnComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UAV_LockOnComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	/** Q key: lock onto the best target, or release the current one. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|LockOn")
	void ToggleLockOn();

	UFUNCTION(BlueprintCallable, Category = "AshenVow|LockOn")
	void ReleaseTarget();

	/** Switch to the next target left (-1) or right (+1) of the current one on screen. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|LockOn")
	void SwitchTarget(float Direction);

	UFUNCTION(BlueprintPure, Category = "AshenVow|LockOn")
	bool IsLockedOn() const { return CurrentTarget != nullptr; }

	UFUNCTION(BlueprintPure, Category = "AshenVow|LockOn")
	AActor* GetCurrentTarget() const { return CurrentTarget; }

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|LockOn")
	FAV_OnTargetLocked OnTargetLocked;

	UPROPERTY(BlueprintAssignable, Category = "AshenVow|LockOn")
	FAV_OnTargetReleased OnTargetReleased;

protected:
	/** Max distance at which a target can be acquired. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn", meta = (ClampMin = "100.0"))
	float AcquireRadius = 1600.f;

	/** Lock breaks if the target gets further than this. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn", meta = (ClampMin = "100.0"))
	float BreakDistance = 2200.f;

	/** Half-angle of the acquisition cone in front of the camera, in degrees. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn", meta = (ClampMin = "10.0", ClampMax = "180.0"))
	float AcquireConeHalfAngle = 70.f;

	/** How fast the camera rotates to face the target. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn", meta = (ClampMin = "1.0"))
	float CameraRotationSpeed = 9.f;

	/** Camera pitch is clamped to this range while locked, keeping both fighters readable. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn")
	float MinLockPitch = -42.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "AshenVow|LockOn")
	float MaxLockPitch = 8.f;

private:
	AActor* FindBestTarget(AActor* Exclude = nullptr) const;
	bool IsValidTarget(AActor* Candidate) const;
	bool HasLineOfSight(AActor* Candidate) const;
	void SetTarget(AActor* NewTarget);
	void UpdateCameraTracking(float DeltaTime);

	UPROPERTY()
	TObjectPtr<AActor> CurrentTarget = nullptr;
};
