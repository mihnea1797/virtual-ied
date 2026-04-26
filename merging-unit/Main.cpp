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
    std::ifstream file("/root/virtual-merging-unit/config.json");
    if (!file)
    {
        std::cerr << "Unable to open config file." << std::endl;
        return 1;
    }

    nlohmann::json config;
    file >> config;

    nlohmann::json gooseSettings = config["gooseSettings"];
    nlohmann::json sampledValuesSettingsArray = config["sampledValuesSettings"];
    if (!sampledValuesSettingsArray.is_array() || sampledValuesSettingsArray.empty())
    {
        std::cerr << "sampledValuesSettings must be a non-empty array in config.json." << std::endl;
        return 1;
    }

    nlohmann::json sampledValuesSettings = sampledValuesSettingsArray[0];
    nlohmann::json signalProperties = sampledValuesSettings["signalProperties"];
    nlohmann::json filterProperties = sampledValuesSettings["filterProperties"];
    nlohmann::json dataFormat = sampledValuesSettings["dataFormat"];
    nlohmann::json postgresSqlProperties = config["postgresSql"];

    SampledValuesSubscriberWrapper::setDataFormat(dataFormat);

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(gooseSettings);
    std::unique_ptr<SampledValuesSubscriberWrapper> sampledValuesSubscriber = std::make_unique<SampledValuesSubscriberWrapper>(sampledValuesSettings);
    SampledValuesSubscriberWrapper::setPostgresConnection(postgresSqlProperties);
    
    for(uint32_t index = 0; index < SampledValuesSubscriberWrapper::getNumberOfPhases(); index++)
    {
        if(SampledValuesSubscriberWrapper::getDataFormat() != DataFormat::onlyI)
        {
            SampledValuesSubscriberWrapper::setVoltageRmsObject(signalProperties);
            SampledValuesSubscriberWrapper::setVoltageButterFilter(filterProperties);
            SampledValuesSubscriberWrapper::setVoltageFrequencyTracker();
        }
        
        if(SampledValuesSubscriberWrapper::getDataFormat() != DataFormat::onlyV)
        {
            SampledValuesSubscriberWrapper::setCurrentRmsObject(signalProperties);
            SampledValuesSubscriberWrapper::setCurrentButterFilter(filterProperties);
            SampledValuesSubscriberWrapper::setCurrentFrequencyTracker();
        }
    }

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
