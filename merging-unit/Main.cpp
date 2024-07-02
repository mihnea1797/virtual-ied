#include "goose-publisher/GoosePublisherWrapper.hpp"
#include "sv-subscriber/SampledValuesSubscriberWrapper.hpp"
#include <memory>

int main(void)
{
    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>("eth0", "AA1J4Q15A1LD0/LLN0.RPG", "AA1J4Q15A1LD0/LLN0$GO$RPG", 500, "AA1J4Q15A1LD0/LLN0$Gss", 1, 4, 0, 0x03, "01:0c:cd:01:00:00");
    std::unique_ptr<SampledValuesSubscriberWrapper> sampledValuesSubscriber = std::make_unique<SampledValuesSubscriberWrapper>("eth0", 0x4000, false, 1.0);
    sampledValuesSubscriber->SetListener(([&]()
                                          { return goosePublisher->PublishMessage(); }));
    sampledValuesSubscriber->Start();

    while(true) {
        // do nothing
    }
    return 0;
}