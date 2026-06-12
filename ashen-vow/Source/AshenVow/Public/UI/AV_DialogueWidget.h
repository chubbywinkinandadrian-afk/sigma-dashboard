#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "AV_DialogueWidget.generated.h"

/**
 * Base for WBP_DialogueBox. The controller owns dialogue state; this widget
 * pulls the current speaker/line for display and forwards the continue input.
 * In the WBP: bind two TextBlocks to the getters and wire a Continue button
 * (and/or a key) to Advance. OnLineChangedBP fires for fade/typewriter effects.
 */
UCLASS(Abstract)
class ASHENVOW_API UAV_DialogueWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintPure, Category = "AshenVow|Dialogue")
	FText GetSpeakerName() const;

	UFUNCTION(BlueprintPure, Category = "AshenVow|Dialogue")
	FText GetLineText() const;

	/** Continue input: next line, or end of conversation. */
	UFUNCTION(BlueprintCallable, Category = "AshenVow|Dialogue")
	void Advance();

	UFUNCTION(BlueprintImplementableEvent, Category = "AshenVow|Dialogue", meta = (DisplayName = "On Line Changed (BP)"))
	void OnLineChangedBP();
};
