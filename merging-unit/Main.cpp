#include "goose-publisher/GoosePublisherWrapper.hpp"
#include "sv-subscriber/SampledValuesSubscriberWrapper.hpp"
#include "ButterworthFilter.hpp"
#include "RmsComputationObject.hpp"
#include <memory>
#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>

int main()
{
    std::ifstream file("/opt/virtual-merging-unit/config.json");
    if (!file)
    {
        std::cerr << "Unable to open config file." << std::endl;
        return 1;
    }

    nlohmann::json config;
    file >> config;

    nlohmann::json gooseSettings = config["gooseSettings"];
    nlohmann::json sampledValuesSettings = config["sampledValuesSettings"];
    nlohmann::json signalProperties = config["signalProperties"];
    nlohmann::json filterProperties = config["filterProperties"];
    SampledValuesSubscriberWrapper::setRmsObject(RmsComputationObject(signalProperties));
    SampledValuesSubscriberWrapper::setButterFilter(ButterworthFilter(filterProperties));

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(gooseSettings);
    std::unique_ptr<SampledValuesSubscriberWrapper> sampledValuesSubscriber = std::make_unique<SampledValuesSubscriberWrapper>(sampledValuesSettings); 

    goosePublisher->Print();
    sampledValuesSubscriber->Print();

    sampledValuesSubscriber->SetListener([&](bool value)
                                         { return goosePublisher->PublishMessage(value); });
    sampledValuesSubscriber->Start();

    while (true)
    {
        // do nothing
    }

    return 0;
}
