#include "Components/AV_LockOnComponent.h"
#include "Interfaces/AV_Targetable.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"

UAV_LockOnComponent::UAV_LockOnComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UAV_LockOnComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!CurrentTarget)
	{
		return;
	}

	const AActor* Owner = GetOwner();
	const bool bTooFar = Owner &&
		FVector::DistSquared(Owner->GetActorLocation(), CurrentTarget->GetActorLocation()) > FMath::Square(BreakDistance);

	if (bTooFar || !IsValidTarget(CurrentTarget))
	{
		ReleaseTarget();
		return;
	}

	UpdateCameraTracking(DeltaTime);
}

void UAV_LockOnComponent::ToggleLockOn()
{
	if (CurrentTarget)
	{
		ReleaseTarget();
		return;
	}

	if (AActor* Best = FindBestTarget())
	{
		SetTarget(Best);
	}
}

void UAV_LockOnComponent::ReleaseTarget()
{
	if (!CurrentTarget)
	{
		return;
	}
	CurrentTarget = nullptr;
	OnTargetReleased.Broadcast();
}

void UAV_LockOnComponent::SwitchTarget(float Direction)
{
	if (!CurrentTarget || FMath::IsNearlyZero(Direction))
	{
		return;
	}

	const APawn* OwnerPawn = Cast<APawn>(GetOwner());
	const AController* Controller = OwnerPawn ? OwnerPawn->GetController() : nullptr;
	if (!Controller)
	{
		return;
	}

	const FVector ViewLocation = OwnerPawn->GetActorLocation();
	const FRotator ViewRotation = Controller->GetControlRotation();
	const FVector ViewRight = FRotationMatrix(ViewRotation).GetUnitAxis(EAxis::Y);
	const FVector ToCurrent = (CurrentTarget->GetActorLocation() - ViewLocation).GetSafeNormal();

	AActor* BestCandidate = nullptr;
	float BestSideDot = TNumericLimits<float>::Max();

	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		AActor* Candidate = *It;
		if (Candidate == CurrentTarget || !IsValidTarget(Candidate) || !HasLineOfSight(Candidate))
		{
			continue;
		}
		if (FVector::DistSquared(ViewLocation, Candidate->GetActorLocation()) > FMath::Square(AcquireRadius))
		{
			continue;
		}

		const FVector ToCandidate = (Candidate->GetActorLocation() - ViewLocation).GetSafeNormal();
		const float SideDot = FVector::DotProduct(ToCandidate - ToCurrent, ViewRight);

		// Candidate must lie on the requested side; prefer the closest angular neighbour.
		if (SideDot * Direction > KINDA_SMALL_NUMBER && FMath::Abs(SideDot) < BestSideDot)
		{
			BestSideDot = FMath::Abs(SideDot);
			BestCandidate = Candidate;
		}
	}

	if (BestCandidate)
	{
		SetTarget(BestCandidate);
	}
}

AActor* UAV_LockOnComponent::FindBestTarget(AActor* Exclude) const
{
	const APawn* OwnerPawn = Cast<APawn>(GetOwner());
	const AController* Controller = OwnerPawn ? OwnerPawn->GetController() : nullptr;
	if (!OwnerPawn || !Controller)
	{
		return nullptr;
	}

	const FVector OwnerLocation = OwnerPawn->GetActorLocation();
	const FVector ViewForward = Controller->GetControlRotation().Vector();
	const float MinDot = FMath::Cos(FMath::DegreesToRadians(AcquireConeHalfAngle));

	AActor* Best = nullptr;
	float BestScore = TNumericLimits<float>::Max();

	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
	{
		AActor* Candidate = *It;
		if (Candidate == Exclude || !IsValidTarget(Candidate))
		{
			continue;
		}

		const FVector ToCandidate = Candidate->GetActorLocation() - OwnerLocation;
		const float Distance = ToCandidate.Size();
		if (Distance > AcquireRadius || Distance < KINDA_SMALL_NUMBER)
		{
			continue;
		}

		const float FacingDot = FVector::DotProduct(ViewForward, ToCandidate / Distance);
		if (FacingDot < MinDot || !HasLineOfSight(Candidate))
		{
			continue;
		}

		// Lower is better: near targets and screen-centered targets win.
		const float Score = Distance * (2.f - FacingDot);
		if (Score < BestScore)
		{
			BestScore = Score;
			Best = Candidate;
		}
	}

	return Best;
}

bool UAV_LockOnComponent::IsValidTarget(AActor* Candidate) const
{
	return Candidate &&
		Candidate->Implements<UAV_Targetable>() &&
		IAV_Targetable::Execute_IsTargetable(Candidate);
}

bool UAV_LockOnComponent::HasLineOfSight(AActor* Candidate) const
{
	const AActor* Owner = GetOwner();
	UWorld* World = GetWorld();
	if (!Owner || !World)
	{
		return false;
	}

	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(AVLockOnLOS), false, Owner);
	Params.AddIgnoredActor(Candidate);

	const FVector Start = Owner->GetActorLocation() + FVector(0.f, 0.f, 50.f);
	const FVector End = IAV_Targetable::Execute_GetTargetPoint(Candidate);

	return !World->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
}

void UAV_LockOnComponent::SetTarget(AActor* NewTarget)
{
	CurrentTarget = NewTarget;
	OnTargetLocked.Broadcast(NewTarget);
}

void UAV_LockOnComponent::UpdateCameraTracking(float DeltaTime)
{
	APawn* OwnerPawn = Cast<APawn>(GetOwner());
	AController* Controller = OwnerPawn ? OwnerPawn->GetController() : nullptr;
	if (!Controller || !CurrentTarget)
	{
		return;
	}

	const FVector FocusPoint = IAV_Targetable::Execute_GetTargetPoint(CurrentTarget);
	const FVector EyeLocation = OwnerPawn->GetActorLocation() + FVector(0.f, 0.f, 60.f);

	FRotator Desired = (FocusPoint - EyeLocation).Rotation();
	Desired.Pitch = FMath::Clamp(Desired.Pitch, MinLockPitch, MaxLockPitch);

	const FRotator Smoothed = FMath::RInterpTo(Controller->GetControlRotation(), Desired, DeltaTime, CameraRotationSpeed);
	Controller->SetControlRotation(Smoothed);
}
